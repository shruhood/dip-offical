import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { auth } from '../services/firebase';
import { useAuth } from './AuthContext';
import { getToolBySlug } from '../data/toolsRegistry';
import {
  evaluateToolAccess,
  getPlanDefinition,
  getToolSingleUsePriceInr,
  hasPlanAccessForTier,
  TOOL_SINGLE_USE_PRICE_INR,
  type ToolAccessEvaluation,
  type ToolPlanCode,
  type ToolPlanDefinition,
} from '../data/toolPlans';
import type {
  AppNotification,
  PaidToolPurchaseRecord,
  ToolDefinition,
  ToolFavouriteDoc,
  ToolHistoryDoc,
  ToolSingleUsePass,
} from '../types/tool';
import {
  clearStoredRecentSlugs,
  MAX_RECENT_TOOLS,
  pushRecentToolSlug,
  readStoredRecentSlugs,
  writeStoredRecentSlugs,
} from '../lib/recentTools';
import {
  readStoredFavourites,
  toggleFavouriteList,
  writeStoredFavourites,
} from '../lib/favouriteTools';
import {
  buildUserNotifications,
  countUnreadNotifications,
  readStoredNotificationState,
  writeStoredNotificationState,
  type LocalNotificationState,
} from '../lib/notifications';

export interface ToolSubscriptionRecord {
  planCode: ToolPlanCode;
  billingCycle: 'monthly' | 'annual';
  amountInr: number;
  orderId?: string;
  paymentMethod?: string;
  activatedAt: string;
}

interface StoredPlanState {
  plan: ToolPlanCode;
  billingCycle: 'monthly' | 'annual';
  creditsRemaining: number;
  dailyJobsDate: string;
  dailyJobsUsed: number;
  lastSubscription?: ToolSubscriptionRecord;
}

interface ToolTrayContextValue {
  plan: ToolPlanCode;
  planDefinition: ToolPlanDefinition;
  billingCycle: 'monthly' | 'annual';
  creditsRemaining: number;
  dailyJobsUsed: number;
  lastSubscription?: ToolSubscriptionRecord;
  singleUsePasses: Record<string, ToolSingleUsePass>;
  activeSingleUsePassList: ToolSingleUsePass[];
  getRemainingSingleUsePasses: (slug: string) => number;
  grantSingleUsePass: (
    toolSlug: string,
    uses?: number,
    paymentMeta?: { orderId?: string; amountInr?: number; paymentMethod?: string }
  ) => void;
  favourites: ToolFavouriteDoc[];
  recentTools: ToolDefinition[];
  history: ToolHistoryDoc[];
  paidToolHistory: PaidToolPurchaseRecord[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  isFavourite: (slug: string) => boolean;
  toggleFavourite: (tool: ToolDefinition) => Promise<void>;
  clearFavourites: () => void;
  trackRecentTool: (slug: string) => void;
  clearRecentTools: () => void;
  recordToolUsage: (entry: Omit<ToolHistoryDoc, 'ownerUid' | 'createdAt'>) => Promise<void>;
  getIdToken: () => Promise<string | null>;
  activatePlan: (
    planCode: ToolPlanCode,
    cycle?: 'monthly' | 'annual',
    paymentMeta?: { orderId?: string; amountInr?: number; paymentMethod?: string }
  ) => void;
  canAccessTool: (tool: ToolDefinition) => ToolAccessEvaluation;
  trayOpen: boolean;
  setTrayOpen: (open: boolean) => void;
}

const ToolTrayContext = createContext<ToolTrayContextValue | null>(null);

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPlanStorageKey(uid?: string | null): string {
  return `dip_tool_plan_v1_${uid || 'guest'}`;
}

function getPassesStorageKey(uid?: string | null): string {
  return `dip_tool_passes_v1_${uid || 'guest'}`;
}

function getHistoryStorageKey(uid?: string | null): string {
  return `dip_tool_history_v1_${uid || 'guest'}`;
}

function getPaidToolHistoryStorageKey(uid?: string | null): string {
  return `dip_paid_tool_history_v1_${uid || 'guest'}`;
}

function readStoredPlanState(uid?: string | null): StoredPlanState {
  const today = todayKey();
  const fallback: StoredPlanState = {
    plan: 'free',
    billingCycle: 'monthly',
    creditsRemaining: 10,
    dailyJobsDate: today,
    dailyJobsUsed: 0,
  };
  try {
    const raw = window.localStorage.getItem(getPlanStorageKey(uid));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredPlanState>;
    const planCode: ToolPlanCode =
      parsed.plan &&
      ['free', 'personal', 'csc', 'professional', 'enterprise'].includes(parsed.plan)
        ? parsed.plan
        : 'free';
    const def = getPlanDefinition(planCode);
    const sameDay = parsed.dailyJobsDate === today;
    return {
      plan: planCode,
      billingCycle: parsed.billingCycle === 'annual' ? 'annual' : 'monthly',
      creditsRemaining:
        typeof parsed.creditsRemaining === 'number'
          ? parsed.creditsRemaining
          : def.monthlyAiCredits,
      dailyJobsDate: today,
      dailyJobsUsed: sameDay && typeof parsed.dailyJobsUsed === 'number' ? parsed.dailyJobsUsed : 0,
      lastSubscription: parsed.lastSubscription,
    };
  } catch {
    return fallback;
  }
}

function readStoredSingleUsePasses(uid?: string | null): Record<string, ToolSingleUsePass> {
  try {
    const raw = window.localStorage.getItem(getPassesStorageKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ToolSingleUsePass>;
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Record<string, ToolSingleUsePass> = {};
    for (const [slug, pass] of Object.entries(parsed)) {
      if (pass && typeof pass.remainingUses === 'number' && pass.remainingUses > 0 && getToolBySlug(slug)) {
        clean[slug] = {
          toolSlug: slug,
          remainingUses: Math.floor(pass.remainingUses),
          priceInr: typeof pass.priceInr === 'number' ? pass.priceInr : TOOL_SINGLE_USE_PRICE_INR,
          orderId: pass.orderId,
          paymentMethod: pass.paymentMethod,
          purchasedAt: pass.purchasedAt || new Date().toISOString(),
        };
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function readStoredHistory(uid?: string | null): ToolHistoryDoc[] {
  try {
    const raw = window.localStorage.getItem(getHistoryStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

function readStoredPaidToolHistory(uid?: string | null): PaidToolPurchaseRecord[] {
  try {
    const raw = window.localStorage.getItem(getPaidToolHistoryStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
  } catch {
    return [];
  }
}

export const ToolTrayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const ownerUid = user?.id || 'guest';

  const [trayOpen, setTrayOpen] = useState(false);
  const [planState, setPlanState] = useState<StoredPlanState>(() =>
    readStoredPlanState(ownerUid)
  );
  const [singleUsePasses, setSingleUsePasses] = useState<Record<string, ToolSingleUsePass>>(() =>
    readStoredSingleUsePasses(ownerUid)
  );
  const [favourites, setFavourites] = useState<ToolFavouriteDoc[]>(() =>
    readStoredFavourites().filter((f) => Boolean(getToolBySlug(f.toolSlug)))
  );
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() =>
    readStoredRecentSlugs().filter((s) => Boolean(getToolBySlug(s)))
  );
  const [history, setHistory] = useState<ToolHistoryDoc[]>(() =>
    readStoredHistory(ownerUid)
  );
  const [paidToolHistory, setPaidToolHistory] = useState<PaidToolPurchaseRecord[]>(() =>
    readStoredPaidToolHistory(ownerUid)
  );
  const [notificationState, setNotificationState] = useState<LocalNotificationState>(() =>
    readStoredNotificationState()
  );

  // Sync plan, passes, and history when signed-in user changes
  useEffect(() => {
    setPlanState(readStoredPlanState(ownerUid));
    setSingleUsePasses(readStoredSingleUsePasses(ownerUid));
    setHistory(readStoredHistory(ownerUid));
    setPaidToolHistory(readStoredPaidToolHistory(ownerUid));
  }, [ownerUid]);

  // Persist plan state
  useEffect(() => {
    try {
      window.localStorage.setItem(getPlanStorageKey(ownerUid), JSON.stringify(planState));
    } catch {
      // ignore storage quota errors
    }
  }, [ownerUid, planState]);

  // Persist single-use ₹10 passes
  useEffect(() => {
    try {
      window.localStorage.setItem(getPassesStorageKey(ownerUid), JSON.stringify(singleUsePasses));
    } catch {
      // ignore storage quota errors
    }
  }, [ownerUid, singleUsePasses]);

  // Persist paid tool purchase & usage ledger
  useEffect(() => {
    try {
      window.localStorage.setItem(
        getPaidToolHistoryStorageKey(ownerUid),
        JSON.stringify(paidToolHistory)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [ownerUid, paidToolHistory]);

  // Backfill any pre-existing active ₹10 passes or subscription into paidToolHistory once
  useEffect(() => {
    setPaidToolHistory((prev) => {
      const next = [...prev];
      let changed = false;

      for (const pass of Object.values(singleUsePasses)) {
        const exists = next.some(
          (item) =>
            item.purchaseType === 'one_time' &&
            item.toolSlug === pass.toolSlug &&
            ((pass.orderId && item.orderId === pass.orderId) ||
              item.purchasedAt === pass.purchasedAt)
        );
        if (!exists) {
          const tool = getToolBySlug(pass.toolSlug);
          next.unshift({
            id: `paid_${pass.toolSlug}_${pass.purchasedAt}`,
            ownerUid,
            purchaseType: 'one_time',
            toolSlug: pass.toolSlug,
            toolName: tool?.name || pass.toolSlug,
            categoryLabel: tool?.categoryLabel,
            amountInr: pass.priceInr || TOOL_SINGLE_USE_PRICE_INR,
            orderId: pass.orderId,
            paymentMethod: pass.paymentMethod || 'Cashfree PG',
            purchasedAt: pass.purchasedAt,
            usesGranted: pass.remainingUses,
            usesConsumed: 0,
          });
          changed = true;
        }
      }

      if (
        planState.lastSubscription &&
        planState.lastSubscription.planCode !== 'free' &&
        planState.lastSubscription.amountInr > 0
      ) {
        const sub = planState.lastSubscription;
        const paidPlanCode = sub.planCode;
        if (paidPlanCode !== 'free') {
          const exists = next.some(
            (item) =>
              item.purchaseType === 'subscription' &&
              ((sub.orderId && item.orderId === sub.orderId) ||
                item.purchasedAt === sub.activatedAt)
          );
          if (!exists) {
            const subDef = getPlanDefinition(paidPlanCode);
            next.unshift({
              id: `sub_${paidPlanCode}_${sub.activatedAt}`,
              ownerUid,
              purchaseType: 'subscription',
              toolName: `${subDef.name} Subscription`,
              categoryLabel: 'Tool Subscription',
              planCode: paidPlanCode,
              billingCycle: sub.billingCycle,
              amountInr: sub.amountInr,
              orderId: sub.orderId,
              paymentMethod: sub.paymentMethod || 'Cashfree PG',
              purchasedAt: sub.activatedAt,
              usesGranted: 1,
              usesConsumed: 0,
            });
            changed = true;
          }
        }
      }

      return changed ? next.slice(0, 100) : prev;
    });
  }, [ownerUid, planState.lastSubscription, singleUsePasses]);

  const planDefinition = useMemo(() => getPlanDefinition(planState.plan), [planState.plan]);

  const activeSingleUsePassList = useMemo(
    () =>
      Object.values(singleUsePasses)
        .filter((p) => p.remainingUses > 0)
        .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()),
    [singleUsePasses]
  );

  const recentTools = useMemo(
    () =>
      recentSlugs
        .map((slug) => getToolBySlug(slug))
        .filter((t): t is ToolDefinition => Boolean(t))
        .slice(0, MAX_RECENT_TOOLS),
    [recentSlugs]
  );

  const notifications = useMemo(
    () =>
      buildUserNotifications({
        favourites,
        readIds: notificationState.readIds,
        dismissedIds: notificationState.dismissedIds,
      }),
    [favourites, notificationState]
  );

  const unreadNotificationCount = useMemo(
    () => countUnreadNotifications(notifications),
    [notifications]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotificationState((prev) => {
      if (prev.readIds.includes(id)) return prev;
      const next: LocalNotificationState = {
        ...prev,
        readIds: [...prev.readIds, id],
      };
      writeStoredNotificationState(next);
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    const allIds = notifications.map((n) => n.id);
    setNotificationState((prev) => {
      const next: LocalNotificationState = {
        ...prev,
        readIds: Array.from(new Set([...prev.readIds, ...allIds])),
      };
      writeStoredNotificationState(next);
      return next;
    });
  }, [notifications]);

  const dismissNotification = useCallback((id: string) => {
    setNotificationState((prev) => {
      if (prev.dismissedIds.includes(id)) return prev;
      const next: LocalNotificationState = {
        ...prev,
        dismissedIds: [...prev.dismissedIds, id],
      };
      writeStoredNotificationState(next);
      return next;
    });
  }, []);

  const isFavourite = useCallback(
    (slug: string) => favourites.some((f) => f.toolSlug === slug),
    [favourites]
  );

  const toggleFavourite = useCallback(
    async (tool: ToolDefinition) => {
      setFavourites((prev) => {
        const { nextList } = toggleFavouriteList(prev, tool, ownerUid);
        writeStoredFavourites(nextList);
        return nextList;
      });
    },
    [ownerUid]
  );

  const clearFavourites = useCallback(() => {
    setFavourites([]);
    writeStoredFavourites([]);
  }, []);

  const trackRecentTool = useCallback((slug: string) => {
    if (!getToolBySlug(slug)) return;
    setRecentSlugs((prev) => {
      const next = pushRecentToolSlug(prev, slug);
      writeStoredRecentSlugs(next);
      return next;
    });
  }, []);

  const clearRecentTools = useCallback(() => {
    setRecentSlugs([]);
    clearStoredRecentSlugs();
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    try {
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const activatePlan = useCallback(
    (
      planCode: ToolPlanCode,
      cycle: 'monthly' | 'annual' = 'monthly',
      paymentMeta?: { orderId?: string; amountInr?: number; paymentMethod?: string }
    ) => {
      const def = getPlanDefinition(planCode);
      const computedPrice =
        cycle === 'annual' ? def.priceAnnualInr ?? 0 : def.priceMonthlyInr ?? 0;
      const finalAmount = paymentMeta?.amountInr ?? computedPrice;
      const activatedAt = new Date().toISOString();
      const paymentMethod =
        paymentMeta?.paymentMethod || (planCode === 'free' ? 'Free Tier' : 'Cashfree PG');

      setPlanState((prev) => ({
        ...prev,
        plan: planCode,
        billingCycle: cycle,
        creditsRemaining: def.monthlyAiCredits,
        dailyJobsDate: todayKey(),
        lastSubscription: {
          planCode,
          billingCycle: cycle,
          amountInr: finalAmount,
          orderId: paymentMeta?.orderId,
          paymentMethod,
          activatedAt,
        },
      }));

      if (planCode !== 'free' && finalAmount > 0) {
        const subRecord: PaidToolPurchaseRecord = {
          id: `paid_sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          ownerUid,
          purchaseType: 'subscription',
          toolName: `${def.name} Subscription`,
          categoryLabel: 'Tool Subscription',
          planCode,
          billingCycle: cycle,
          amountInr: finalAmount,
          orderId: paymentMeta?.orderId,
          paymentMethod,
          purchasedAt: activatedAt,
          usesGranted: 1,
          usesConsumed: 0,
        };
        setPaidToolHistory((prev) => [subRecord, ...prev].slice(0, 100));
      }
    },
    [ownerUid]
  );

  const getRemainingSingleUsePasses = useCallback(
    (slug: string): number => singleUsePasses[slug]?.remainingUses ?? 0,
    [singleUsePasses]
  );

  const grantSingleUsePass = useCallback(
    (
      toolSlug: string,
      uses = 1,
      paymentMeta?: { orderId?: string; amountInr?: number; paymentMethod?: string }
    ) => {
      const tool = getToolBySlug(toolSlug);
      if (!tool) return;
      const qty = Math.max(1, Math.floor(uses));
      const priceInr = paymentMeta?.amountInr ?? (getToolSingleUsePriceInr(tool) || TOOL_SINGLE_USE_PRICE_INR);
      const purchasedAt = new Date().toISOString();
      const paymentMethod = paymentMeta?.paymentMethod || 'Cashfree PG';

      setSingleUsePasses((prev) => {
        const existing = prev[toolSlug];
        return {
          ...prev,
          [toolSlug]: {
            toolSlug,
            remainingUses: (existing?.remainingUses ?? 0) + qty,
            priceInr,
            orderId: paymentMeta?.orderId || existing?.orderId,
            paymentMethod: paymentMethod || existing?.paymentMethod,
            purchasedAt,
          },
        };
      });

      const passRecord: PaidToolPurchaseRecord = {
        id: `paid_pass_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ownerUid,
        purchaseType: 'one_time',
        toolSlug,
        toolName: tool.name,
        categoryLabel: tool.categoryLabel,
        amountInr: priceInr,
        orderId: paymentMeta?.orderId,
        paymentMethod,
        purchasedAt,
        usesGranted: qty,
        usesConsumed: 0,
      };
      setPaidToolHistory((prev) => [passRecord, ...prev].slice(0, 100));
    },
    [ownerUid]
  );

  const canAccessTool = useCallback(
    (tool: ToolDefinition): ToolAccessEvaluation => {
      return evaluateToolAccess({
        tool,
        userPlan: planState.plan,
        dailyJobsUsed: planState.dailyJobsUsed,
        creditsRemaining: planState.creditsRemaining,
        singleUsePassesRemaining: singleUsePasses[tool.slug]?.remainingUses ?? 0,
      });
    },
    [planState.creditsRemaining, planState.dailyJobsUsed, planState.plan, singleUsePasses]
  );

  const recordToolUsage = useCallback(
    async (entry: Omit<ToolHistoryDoc, 'ownerUid' | 'createdAt'>) => {
      const nowIso = new Date().toISOString();
      const doc: ToolHistoryDoc = {
        ...entry,
        id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ownerUid,
        createdAt: nowIso,
      };
      setHistory((prev) => {
        const next = [doc, ...prev].slice(0, 40);
        try {
          window.localStorage.setItem(getHistoryStorageKey(ownerUid), JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      const tool = getToolBySlug(entry.toolSlug);
      const today = todayKey();
      const currentPlanDef = getPlanDefinition(planState.plan);
      const needsSingleUsePass = Boolean(
        tool &&
          (!hasPlanAccessForTier(planState.plan, tool.tier) ||
            (currentPlanDef.dailyJobLimit !== null &&
              planState.dailyJobsUsed >= currentPlanDef.dailyJobLimit) ||
            (tool.isAiPowered && planState.creditsRemaining <= 0))
      );

      if (needsSingleUsePass && entry.status === 'completed') {
        setSingleUsePasses((prev) => {
          const existing = prev[entry.toolSlug];
          if (!existing || existing.remainingUses <= 0) return prev;
          const remaining = existing.remainingUses - 1;
          if (remaining <= 0) {
            const { [entry.toolSlug]: _removed, ...rest } = prev;
            return rest;
          }
          return {
            ...prev,
            [entry.toolSlug]: {
              ...existing,
              remainingUses: remaining,
            },
          };
        });

        setPaidToolHistory((prev) => {
          const targetIdx = prev.findIndex(
            (item) =>
              item.purchaseType === 'one_time' &&
              item.toolSlug === entry.toolSlug &&
              item.usesConsumed < item.usesGranted
          );
          if (targetIdx === -1) return prev;
          return prev.map((item, idx) =>
            idx === targetIdx
              ? {
                  ...item,
                  usesConsumed: item.usesConsumed + 1,
                  lastUsedAt: nowIso,
                }
              : item
          );
        });
      }

      setPlanState((prev) => {
        const sameDay = prev.dailyJobsDate === today;
        const nextDaily = (sameDay ? prev.dailyJobsUsed : 0) + 1;
        const nextCredits =
          tool?.isAiPowered && prev.creditsRemaining > 0
            ? prev.creditsRemaining - 1
            : prev.creditsRemaining;
        return {
          ...prev,
          dailyJobsDate: today,
          dailyJobsUsed: nextDaily,
          creditsRemaining: nextCredits,
        };
      });
    },
    [ownerUid, planState.creditsRemaining, planState.dailyJobsUsed, planState.plan]
  );

  return (
    <ToolTrayContext.Provider
      value={{
        plan: planState.plan,
        planDefinition,
        billingCycle: planState.billingCycle,
        creditsRemaining: planState.creditsRemaining,
        dailyJobsUsed: planState.dailyJobsUsed,
        lastSubscription: planState.lastSubscription,
        singleUsePasses,
        activeSingleUsePassList,
        getRemainingSingleUsePasses,
        grantSingleUsePass,
        favourites,
        recentTools,
        history,
        paidToolHistory,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,
        dismissNotification,
        isFavourite,
        toggleFavourite,
        clearFavourites,
        trackRecentTool,
        clearRecentTools,
        recordToolUsage,
        getIdToken,
        activatePlan,
        canAccessTool,
        trayOpen,
        setTrayOpen,
      }}
    >
      {children}
    </ToolTrayContext.Provider>
  );
};

export function useToolTray(): ToolTrayContextValue {
  const ctx = useContext(ToolTrayContext);
  if (!ctx) {
    throw new Error('useToolTray must be used within ToolTrayProvider');
  }
  return ctx;
}
