// src/components/ui/index.tsx
// Componentes base do design system. Todas as telas devem usar estes blocos
// para manter o mesmo espaçamento, tipografia e cores nos dois temas.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Page */

export function Page({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
    return <div className={cx("px-4 py-6 md:px-8 md:py-8 mx-auto w-full space-y-6", narrow ? "max-w-4xl" : "max-w-[1400px]", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions, meta }: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    meta?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
                {description && <p className="mt-1 text-sm text-fg-subtle">{description}</p>}
                {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </div>
    );
}

/* ------------------------------------------------------------------ Card */

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
    return (
        <div className={cx("rounded-xl border border-line bg-surface shadow-[var(--ui-shadow)]", padded && "p-5", className)}>
            {children}
        </div>
    );
}

export function CardHeader({ title, description, action, icon: Icon, className }: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    icon?: LucideIcon;
    className?: string;
}) {
    return (
        <div className={cx("flex items-start justify-between gap-3 px-5 py-4 border-b border-line", className)}>
            <div className="flex items-start gap-3 min-w-0">
                {Icon && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle border border-line text-fg-subtle">
                        <Icon className="h-4 w-4" />
                    </div>
                )}
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-fg">{title}</h3>
                    {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

/* ------------------------------------------------------------------ Tones */

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const toneSoft: Record<Tone, string> = {
    neutral: "bg-subtle text-fg-muted border-line",
    primary: "bg-primary-soft text-primary-text border-transparent",
    success: "bg-success-soft text-success border-transparent",
    warning: "bg-warning-soft text-warning border-transparent",
    danger: "bg-danger-soft text-danger border-transparent",
    info: "bg-info-soft text-info border-transparent",
};


export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
    return (
        <span className={cx("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneSoft[tone], className)}>
            {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            {children}
        </span>
    );
}

/* ------------------------------------------------------------------ Stat */

export function StatCard({ label, value, hint, icon: Icon, tone = "neutral", onClick, active, className }: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: LucideIcon;
    tone?: Tone;
    onClick?: () => void;
    active?: boolean;
    className?: string;
}) {
    const Comp = onClick ? "button" : "div";
    return (
        <Comp
            onClick={onClick}
            className={cx(
                "text-left rounded-xl border bg-surface p-5 shadow-[var(--ui-shadow)] transition-colors",
                active ? "border-primary ring-3 ring-primary/15" : "border-line",
                onClick && !active && "hover:border-line-strong",
                className
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-fg-subtle">{label}</span>
                {Icon && (
                    <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", toneSoft[tone])}>
                        <Icon className="h-4 w-4" />
                    </span>
                )}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg tabular">{value}</div>
            {hint && <div className="mt-1 text-xs text-fg-subtle">{hint}</div>}
        </Comp>
    );
}

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const buttonVariant: Record<ButtonVariant, string> = {
    primary: "bg-primary text-white hover:bg-primary-hover border-transparent shadow-[var(--ui-shadow)]",
    secondary: "bg-surface text-fg border-line hover:bg-hover shadow-[var(--ui-shadow)]",
    ghost: "bg-transparent text-fg-muted border-transparent hover:bg-hover hover:text-fg",
    danger: "bg-surface text-danger border-line hover:bg-danger-soft",
    success: "bg-success text-white border-transparent hover:opacity-90",
};

export function Button({ variant = "secondary", size = "md", icon: Icon, loading, children, className, ...props }:
    ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: ButtonVariant;
        size?: "sm" | "md" | "lg";
        icon?: LucideIcon;
        loading?: boolean;
    }) {
    const sizes = { sm: "h-8 px-2.5 text-xs gap-1.5", md: "h-9 px-3.5 text-sm gap-2", lg: "h-11 px-5 text-sm gap-2" };
    return (
        <button
            {...props}
            disabled={props.disabled || loading}
            className={cx(
                "inline-flex items-center justify-center rounded-lg border font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px",
                sizes[size],
                buttonVariant[variant],
                className
            )}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
            {children}
        </button>
    );
}

export function IconButton({ icon: Icon, label, tone, className, ...props }:
    ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: "danger" | "success" | "primary" }) {
    const hover = tone === "danger" ? "hover:text-danger hover:bg-danger-soft"
        : tone === "success" ? "hover:text-success hover:bg-success-soft"
            : tone === "primary" ? "hover:text-primary-text hover:bg-primary-soft"
                : "hover:text-fg hover:bg-hover";
    return (
        <button
            {...props}
            title={label}
            aria-label={label}
            className={cx("inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle transition-colors disabled:opacity-40", hover, className)}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

/* ------------------------------------------------------------------ Segmented */

export function Segmented<T extends string>({ options, value, onChange, className }: {
    options: { value: T; label: ReactNode }[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}) {
    return (
        <div className={cx("inline-flex items-center gap-0.5 rounded-lg border border-line bg-subtle p-0.5", className)}>
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cx(
                        "h-8 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                        value === opt.value
                            ? "bg-surface text-fg shadow-[var(--ui-shadow)] border border-line"
                            : "text-fg-subtle hover:text-fg border border-transparent"
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ Search */

export function SearchInput({ value, onChange, placeholder, className, icon: Icon }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    icon: LucideIcon;
}) {
    return (
        <div className={cx("relative", className)}>
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="ui-input pl-9"
            />
        </div>
    );
}

/* ------------------------------------------------------------------ Empty / Loading */

export function EmptyState({ icon: Icon, title, description, action, className }: {
    icon: LucideIcon;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx("flex flex-col items-center justify-center text-center px-6 py-14", className)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-subtle text-fg-subtle">
                <Icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-fg">{title}</p>
            {description && <p className="mt-1 max-w-sm text-sm text-fg-subtle">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-fg-subtle">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            {label}
        </div>
    );
}

/* ------------------------------------------------------------------ Progress */

export function Meter({ value, max, tone = "primary" }: { value: number; max: number; tone?: Tone }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const bar: Record<Tone, string> = {
        neutral: "bg-fg-faint", primary: "bg-primary", success: "bg-success",
        warning: "bg-warning", danger: "bg-danger", info: "bg-info",
    };
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle border border-line/60">
            <div className={cx("h-full rounded-full transition-all", bar[tone])} style={{ width: `${pct}%` }} />
        </div>
    );
}
