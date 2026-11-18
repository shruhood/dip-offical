import React from 'react';

export const BRAND_LOGO_URL =
  '/assets/aistudio/696093696_122307239654025841_4128613407348569440_n_77583d2a.jpg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showSubtitle = false }) => {
  const iconSize = size === 'sm' ? 30 : size === 'lg' ? 44 : 36;

  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 select-none whitespace-nowrap shrink-0 ${className}`}>
      <div
        className="relative flex items-center justify-center shrink-0 rounded-lg sm:rounded-xl overflow-hidden bg-white border border-slate-200/90 dark:border-slate-700 shadow-2xs"
        style={{ width: iconSize, height: iconSize }}
      >
        <img
          src={BRAND_LOGO_URL}
          alt="Digital India Project Logo"
          className="w-full h-full object-contain p-0.5"
        />
      </div>

      <div className="flex flex-col leading-none min-w-0">
        <div className="flex items-center gap-1 font-display font-extrabold tracking-tight text-[#202124] dark:text-white whitespace-nowrap">
          <span className="text-[#FF671F] text-[14.5px] sm:text-[1.0625rem]">Digital India</span>
          <span className="text-[#202124] dark:text-white text-[14.5px] sm:text-[1.0625rem]">Project</span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] tracking-wide font-medium text-[#64748B] dark:text-slate-400 mt-0.5 whitespace-nowrap">
            Karta Files · Online Assistance
          </span>
        )}
      </div>
    </div>
  );
};
