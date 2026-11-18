import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import {
  ADMIN_BOOTSTRAP_EMAIL,
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import { CORE_CATALOGUE_ITEMS, COMPLETE_CATALOGUE_ITEMS } from '../data/catalogue';
import type { CatalogueImportReport, Service, UserRole } from '../types';
import { isSuperAdminRole } from './rbac';
import {
  type FirestoreServiceRecord,
  planIdempotentServicesSync,
} from './catalogueSync';

export interface FirestoreSyncExecutionResult {
  report: CatalogueImportReport;
  dryRun: boolean;
  createdIds: string[];
  updatedIds: string[];
  skippedIds: string[];
}

export function assertAdminSyncPermission(userRole?: UserRole): void {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: Sign in as an Admin to sync the Services catalog.');
  }
  const email = (currentUser.email || '').toLowerCase();
  const isAllowedAdmin =
    email === ADMIN_BOOTSTRAP_EMAIL ||
    userRole === 'admin' ||
    isSuperAdminRole(userRole);

  if (!isAllowedAdmin) {
    throw new Error('Forbidden: Only Admin or Super Admin accounts can run Services catalog database sync.');
  }
}

/**
 * Admin-Only Idempotent Sync for Firestore `/services/{serviceId}`.
 *
 * - Reads existing documents from `collection(db, 'services')`
 * - Matches each of the 145 core catalog items (or 149 with packages) by `id` OR lowercase `slug`
 * - Preserves existing customizations while backfilling missing/canonical SEO & catalog fields
 * - Writes ONLY new or semantically changed items in batches (skipping unchanged records cleanly)
 */
export async function syncServicesCatalogueToFirestore(params?: {
  userRole?: UserRole;
  actorName?: string;
  includePackages?: boolean;
  dryRun?: boolean;
  forceRefreshSeo?: boolean;
  preserveExistingCustomizations?: boolean;
}): Promise<FirestoreSyncExecutionResult> {
  assertAdminSyncPermission(params?.userRole);

  const catalog: Service[] = params?.includePackages
    ? COMPLETE_CATALOGUE_ITEMS
    : CORE_CATALOGUE_ITEMS;

  let existingRecords: Record<string, any>[] = [];
  try {
    const snap = await getDocs(collection(db, 'services'));
    existingRecords = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'services');
  }

  const plan = planIdempotentServicesSync({
    catalog,
    existingRecords,
    actorName: params?.actorName || auth.currentUser?.displayName || auth.currentUser?.email || 'Super Admin',
    preserveExistingCustomizations: params?.preserveExistingCustomizations ?? true,
    forceRefreshSeo: params?.forceRefreshSeo ?? true,
  });

  const pendingWrites: FirestoreServiceRecord[] = [...plan.toCreate, ...plan.toUpdate];

  if (!params?.dryRun && pendingWrites.length > 0) {
    try {
      const BATCH_CHUNK = 200;
      for (let i = 0; i < pendingWrites.length; i += BATCH_CHUNK) {
        const chunk = pendingWrites.slice(i, i + BATCH_CHUNK);
        const batch = writeBatch(db);
        for (const record of chunk) {
          batch.set(doc(db, 'services', record.id), record);
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'services');
    }
  }

  return {
    report: plan.report,
    dryRun: Boolean(params?.dryRun),
    createdIds: plan.toCreate.map((r) => r.id),
    updatedIds: plan.toUpdate.map((r) => r.id),
    skippedIds: plan.unchanged.map((r) => r.id),
  };
}
