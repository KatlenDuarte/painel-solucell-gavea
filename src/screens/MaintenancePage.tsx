// src/screens/Maintenance.tsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Wrench,
    Search,
    Plus,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Package,
    DollarSign,
    Calendar,
    Loader,
    ArrowUp,
    ArrowDown,
    Edit2,
    Trash2,
    Zap,
    Phone,
    User,
    Smartphone,
    Filter,
    CreditCard,
    BadgeDollarSign
} from "lucide-react";

import {
    fetchMaintenances,
    deleteMaintenance as deleteMaintenanceService,
    updateMaintenance as updateMaintenanceService
} from "../services/maintenanceService";

import AddMaintenanceModal from "../components/AddMaintenanceModal";
import EditMaintenanceModal from "../components/EditMaintenanceModal";

interface Maintenance {
    id: string;
    customer: string;
    phone: string;
    device: string;
    brand: string;
    model: string;
    issue: string;
    status:
        | "pending"
        | "parts_ordered"
        | "in_progress"
        | "completed"
        | "cancelled";
    value: number;
    paid: boolean;
    partOrdered: boolean;
    orderDate?: string;
    deliveryDate?: string;
    createdAt: string;
    notes?: string;
}

const useAuth = () => ({
    storeEmail: "minha-loja@exemplo.com"
});

export default function MaintenancePage() {
    const { storeEmail } = useAuth();

    const [loading, setLoading] = useState(true);
    const [maintenances, setMaintenances] = useState<Maintenance[]>([]);

    // filtros
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");

    // períodos
    const [period, setPeriod] = useState<
        "today" | "week" | "month" | "year" | "custom_day" | "custom_month"
    >("today");

    const [selectedDay, setSelectedDay] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().getMonth()
    );
    const [selectedYear, setSelectedYear] = useState(
        new Date().getFullYear()
    );

    // ordenação
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
        "desc"
    );

    // modais
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    const [selectedMaintenance, setSelectedMaintenance] =
        useState<Maintenance | null>(null);

    const [quickActionLoadingId, setQuickActionLoadingId] = useState<
        string | null
    >(null);

    const loadMaintenances = useCallback(async () => {
        if (!storeEmail) return;

        setLoading(true);

        try {
            const data = await fetchMaintenances(storeEmail);
            setMaintenances(data as Maintenance[]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [storeEmail]);

    useEffect(() => {
        loadMaintenances();
    }, [loadMaintenances]);

    const statusConfig = {
        pending: {
            label: "Aguardando",
            color:
                "bg-amber-500/10 text-amber-400 border-amber-500/20",
            icon: Clock
        },
        parts_ordered: {
            label: "Peça Pedida",
            color:
                "bg-blue-500/10 text-blue-400 border-blue-500/20",
            icon: Package
        },
        in_progress: {
            label: "Em Reparo",
            color:
                "bg-purple-500/10 text-purple-400 border-purple-500/20",
            icon: Wrench
        },
        completed: {
            label:
                "Concluído",
            color:
                "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            icon: CheckCircle
        },
        cancelled: {
            label:
                "Cancelado",
            color:
                "bg-red-500/10 text-red-400 border-red-500/20",
            icon: XCircle
        }
    };

    const processedMaintenances = useMemo(() => {
        const now = new Date();

        let startDate: Date;
        let endDate: Date | null = null;

        switch (period) {
            case "today":
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                );
                break;

            case "week":
                startDate = new Date();
                startDate.setDate(now.getDate() - 7);
                break;

            case "month":
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                );
                break;

            case "year":
                startDate = new Date(now.getFullYear(), 0, 1);
                break;

            case "custom_month":
                startDate = new Date(selectedYear, selectedMonth, 1);
                endDate = new Date(
                    selectedYear,
                    selectedMonth + 1,
                    0,
                    23,
                    59,
                    59
                );
                break;

            case "custom_day":
                if (!selectedDay) {
                    startDate = new Date(0);
                } else {
                    const [y, m, d] = selectedDay
                        .split("-")
                        .map(Number);

                    startDate = new Date(y, m - 1, d, 0, 0, 0);

                    endDate = new Date(y, m - 1, d, 23, 59, 59);
                }

                break;

            default:
                startDate = new Date(0);
        }

        const filtered = maintenances.filter((m) => {
            const created = new Date(m.createdAt);

            const matchesDate = endDate
                ? created >= startDate && created <= endDate
                : created >= startDate;

            if (!matchesDate) return false;

            const term = searchTerm.toLowerCase();

            const matchesSearch =
                m.customer.toLowerCase().includes(term) ||
                m.device.toLowerCase().includes(term) ||
                m.issue.toLowerCase().includes(term) ||
                m.brand.toLowerCase().includes(term);

            if (!matchesSearch) return false;

            const matchesStatus =
                statusFilter === "all" ||
                m.status === statusFilter;

            if (!matchesStatus) return false;

            if (paymentFilter === "paid" && !m.paid)
                return false;

            if (paymentFilter === "pending" && m.paid)
                return false;

            return true;
        });

        return filtered.sort((a, b) => {
            if (sortDirection === "asc") {
                return a.value - b.value;
            }

            return b.value - a.value;
        });
    }, [
        maintenances,
        period,
        selectedDay,
        selectedMonth,
        selectedYear,
        searchTerm,
        statusFilter,
        paymentFilter,
        sortDirection
    ]);

    const metrics = useMemo(() => {
        const total = processedMaintenances.reduce(
            (acc, item) => acc + item.value,
            0
        );

        const completed = processedMaintenances.filter(
            (m) => m.status === "completed"
        ).length;

        const pending = processedMaintenances.filter(
            (m) =>
                m.status === "pending" ||
                m.status === "in_progress"
        ).length;

        const paid = processedMaintenances.filter(
            (m) => m.paid
        ).length;

        const unpaid = processedMaintenances.filter(
            (m) => !m.paid
        ).length;

        return {
            total,
            completed,
            pending,
            paid,
            unpaid
        };
    }, [processedMaintenances]);

    const toggleSort = () => {
        setSortDirection((prev) =>
            prev === "desc" ? "asc" : "desc"
        );
    };

    const openEditModal = (m: Maintenance) => {
        setSelectedMaintenance(m);
        setShowEditModal(true);
    };

    const handleDataUpdate = () => {
        setShowAddModal(false);
        setShowEditModal(false);
        loadMaintenances();
    };

    const handleDelete = async (id: string) => {
        const confirmDelete = confirm(
            "Deseja excluir esta manutenção?"
        );

        if (!confirmDelete) return;

        try {
            await deleteMaintenanceService(id);
            loadMaintenances();
        } catch (error) {
            console.error(error);
        }
    };

    const togglePaidStatus = async (
        maintenance: Maintenance
    ) => {
        setQuickActionLoadingId(maintenance.id);

        try {
            await updateMaintenanceService(maintenance.id, {
                paid: !maintenance.paid
            });

            setMaintenances((prev) =>
                prev.map((m) =>
                    m.id === maintenance.id
                        ? { ...m, paid: !m.paid }
                        : m
                )
            );
        } catch (error) {
            console.error(error);
        } finally {
            setQuickActionLoadingId(null);
        }
    };

    const advanceStatus = async (
        maintenance: Maintenance
    ) => {
        const flow: Maintenance["status"][] = [
            "pending",
            "parts_ordered",
            "in_progress",
            "completed"
        ];

        const currentIndex = flow.indexOf(
            maintenance.status
        );

        if (
            currentIndex === -1 ||
            maintenance.status === "completed" ||
            maintenance.status === "cancelled"
        ) {
            return;
        }

        const nextStatus = flow[currentIndex + 1];

        if (!nextStatus) return;

        setQuickActionLoadingId(maintenance.id);

        try {
            await updateMaintenanceService(maintenance.id, {
                status: nextStatus
            });

            setMaintenances((prev) =>
                prev.map((m) =>
                    m.id === maintenance.id
                        ? { ...m, status: nextStatus }
                        : m
                )
            );
        } catch (error) {
            console.error(error);
        } finally {
            setQuickActionLoadingId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 text-xs font-semibold uppercase tracking-widest animate-pulse">
                Carregando manutenções...
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-[#020617] min-h-screen space-y-6 text-slate-300">

            {/* HEADER */}

            <header className="flex flex-col lg:flex-row justify-between gap-5 border-b border-slate-900 pb-6">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                        Central de{" "}
                        <span className="text-blue-500">
                            Manutenções
                        </span>
                    </h1>

                    <p className="text-slate-500 text-xs mt-2">
                        Controle operacional completo de reparos,
                        pagamentos e entregas.
                    </p>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-xs font-bold tracking-wide transition-all"
                >
                    <Plus size={15} />
                    Nova Manutenção
                </button>
            </header>

            {/* FILTROS */}

            <section className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-4 gap-5">

                {/* busca */}

                <div className="space-y-2">
                    <p className="text-[11px] uppercase text-slate-500 font-semibold">
                        Buscar
                    </p>

                    <div className="relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                            size={14}
                        />

                        <input
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(e.target.value)
                            }
                            placeholder="Cliente, aparelho..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-slate-700"
                        />
                    </div>
                </div>

                {/* status */}

                <div className="space-y-2">
                    <p className="text-[11px] uppercase text-slate-500 font-semibold">
                        Status
                    </p>

                    <select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                        <option value="all">
                            Todos
                        </option>

                        {Object.entries(statusConfig).map(
                            ([key, value]) => (
                                <option
                                    key={key}
                                    value={key}
                                >
                                    {value.label}
                                </option>
                            )
                        )}
                    </select>
                </div>

                {/* pagamento */}

                <div className="space-y-2">
                    <p className="text-[11px] uppercase text-slate-500 font-semibold">
                        Pagamento
                    </p>

                    <select
                        value={paymentFilter}
                        onChange={(e) =>
                            setPaymentFilter(e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                        <option value="all">
                            Todos
                        </option>
                        <option value="paid">
                            Pagos
                        </option>
                        <option value="pending">
                            Pendentes
                        </option>
                    </select>
                </div>

                {/* dia */}

                <div className="space-y-2">
                    <p className="text-[11px] uppercase text-slate-500 font-semibold">
                        Data específica
                    </p>

                    <input
                        type="date"
                        value={selectedDay}
                        onChange={(e) => {
                            setSelectedDay(e.target.value);
                            setPeriod("custom_day");
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                </div>
            </section>

            {/* PERÍODOS */}

            <div className="flex flex-wrap gap-2">
                {[
                    {
                        label: "Hoje",
                        value: "today"
                    },
                    {
                        label: "7 Dias",
                        value: "week"
                    },
                    {
                        label: "Mês",
                        value: "month"
                    },
                    {
                        label: "Ano",
                        value: "year"
                    }
                ].map((item) => (
                    <button
                        key={item.value}
                        onClick={() =>
                            setPeriod(item.value as any)
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            period === item.value
                                ? "bg-slate-800 text-white border-slate-700"
                                : "bg-transparent text-slate-500 border-slate-900 hover:text-slate-300"
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {/* CARDS */}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">

                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
                    <p className="text-slate-500 text-xs uppercase">
                        Faturamento
                    </p>

                    <h2 className="text-2xl font-bold text-white mt-2">
                        R$ {metrics.total.toFixed(2)}
                    </h2>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
                    <p className="text-slate-500 text-xs uppercase">
                        Concluídos
                    </p>

                    <h2 className="text-2xl font-bold text-emerald-400 mt-2">
                        {metrics.completed}
                    </h2>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
                    <p className="text-slate-500 text-xs uppercase">
                        Em andamento
                    </p>

                    <h2 className="text-2xl font-bold text-amber-400 mt-2">
                        {metrics.pending}
                    </h2>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
                    <p className="text-slate-500 text-xs uppercase">
                        Pagos
                    </p>

                    <h2 className="text-2xl font-bold text-blue-400 mt-2">
                        {metrics.paid}
                    </h2>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
                    <p className="text-slate-500 text-xs uppercase">
                        Pendentes
                    </p>

                    <h2 className="text-2xl font-bold text-red-400 mt-2">
                        {metrics.unpaid}
                    </h2>
                </div>

            </div>

            {/* TABELA */}

            <section className="bg-slate-900/10 border border-slate-900 rounded-2xl overflow-hidden">

                <div className="overflow-x-auto">

                    <table className="w-full">

                        <thead>

                            <tr className="bg-slate-950/40 border-b border-slate-900">

                                <th className="px-6 py-4 text-left text-[10px] uppercase text-slate-500">
                                    Cliente
                                </th>

                                <th className="px-6 py-4 text-left text-[10px] uppercase text-slate-500">
                                    Aparelho
                                </th>

                                <th className="px-6 py-4 text-left text-[10px] uppercase text-slate-500">
                                    Problema
                                </th>

                                <th className="px-6 py-4 text-center text-[10px] uppercase text-slate-500">
                                    Status
                                </th>

                                <th className="px-6 py-4 text-center text-[10px] uppercase text-slate-500">
                                    Valor
                                </th>

                                <th className="px-6 py-4 text-center text-[10px] uppercase text-slate-500">
                                    Pagamento
                                </th>

                                <th className="px-6 py-4 text-right text-[10px] uppercase text-slate-500">
                                    Data
                                </th>

                                <th className="px-6 py-4 text-center text-[10px] uppercase text-slate-500">
                                    Ações
                                </th>

                            </tr>

                        </thead>

                        <tbody className="divide-y divide-slate-900/50">

                            {processedMaintenances.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="text-center py-12 text-slate-600 text-xs"
                                    >
                                        Nenhuma manutenção encontrada.
                                    </td>
                                </tr>
                            )}

                            {processedMaintenances.map((m) => {
                                const StatusIcon =
                                    statusConfig[m.status].icon;

                                const isLoading =
                                    quickActionLoadingId ===
                                    m.id;

                                return (
                                    <tr
                                        key={m.id}
                                        className="hover:bg-slate-900/20 transition-colors"
                                    >

                                        <td className="px-6 py-4">

                                            <div className="flex flex-col">

                                                <span className="text-xs text-white font-semibold">
                                                    {m.customer}
                                                </span>

                                                <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                                                    <Phone size={10} />
                                                    {m.phone}
                                                </span>

                                            </div>

                                        </td>

                                        <td className="px-6 py-4">

                                            <div className="flex flex-col">

                                                <span className="text-xs text-white font-semibold">
                                                    {m.device}
                                                </span>

                                                <span className="text-[10px] text-slate-500">
                                                    {m.brand} • {m.model}
                                                </span>

                                            </div>

                                        </td>

                                        <td className="px-6 py-4 max-w-[260px]">

                                            <p className="text-xs text-slate-300 line-clamp-2">
                                                {m.issue}
                                            </p>

                                        </td>

                                        <td className="px-6 py-4 text-center">

                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold ${statusConfig[m.status].color}`}
                                            >
                                                <StatusIcon size={11} />
                                                {
                                                    statusConfig[
                                                        m.status
                                                    ].label
                                                }
                                            </span>

                                        </td>

                                        <td className="px-6 py-4 text-center">

                                            <button
                                                onClick={toggleSort}
                                                className="inline-flex items-center gap-1 text-white font-bold text-xs"
                                            >
                                                R$ {m.value.toFixed(2)}

                                                {sortDirection ===
                                                "desc" ? (
                                                    <ArrowDown
                                                        size={12}
                                                        className="text-blue-500"
                                                    />
                                                ) : (
                                                    <ArrowUp
                                                        size={12}
                                                        className="text-emerald-500"
                                                    />
                                                )}
                                            </button>

                                        </td>

                                        <td className="px-6 py-4 text-center">

                                            <button
                                                onClick={() =>
                                                    togglePaidStatus(m)
                                                }
                                                disabled={
                                                    isLoading
                                                }
                                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                    m.paid
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                        : "bg-red-500/10 text-red-400 border-red-500/20"
                                                }`}
                                            >
                                                {isLoading ? (
                                                    <Loader
                                                        size={11}
                                                        className="animate-spin"
                                                    />
                                                ) : m.paid ? (
                                                    "PAGO"
                                                ) : (
                                                    "PENDENTE"
                                                )}
                                            </button>

                                        </td>

                                        <td className="px-6 py-4 text-right">

                                            <div className="flex flex-col items-end">

                                                <span className="text-xs text-slate-400">
                                                    {new Date(
                                                        m.createdAt
                                                    ).toLocaleDateString(
                                                        "pt-BR"
                                                    )}
                                                </span>

                                                <span className="text-[10px] text-slate-600 mt-1">
                                                    {new Date(
                                                        m.createdAt
                                                    ).toLocaleTimeString(
                                                        "pt-BR",
                                                        {
                                                            hour: "2-digit",
                                                            minute:
                                                                "2-digit"
                                                        }
                                                    )}
                                                </span>

                                            </div>

                                        </td>

                                        <td className="px-6 py-4">

                                            <div className="flex items-center justify-center gap-2">

                                                {![
                                                    "completed",
                                                    "cancelled"
                                                ].includes(
                                                    m.status
                                                ) && (
                                                    <button
                                                        onClick={() =>
                                                            advanceStatus(
                                                                m
                                                            )
                                                        }
                                                        className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/10 transition-all"
                                                    >
                                                        <Zap
                                                            size={
                                                                14
                                                            }
                                                            className="text-blue-400"
                                                        />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() =>
                                                        openEditModal(
                                                            m
                                                        )
                                                    }
                                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all"
                                                >
                                                    <Edit2
                                                        size={
                                                            14
                                                        }
                                                        className="text-slate-300"
                                                    />
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        handleDelete(
                                                            m.id
                                                        )
                                                    }
                                                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all"
                                                >
                                                    <Trash2
                                                        size={
                                                            14
                                                        }
                                                        className="text-red-400"
                                                    />
                                                </button>

                                            </div>

                                        </td>

                                    </tr>
                                );
                            })}

                        </tbody>

                    </table>

                </div>

            </section>

            {/* MODAIS */}

            {showAddModal && (
                <AddMaintenanceModal
                    onClose={() =>
                        setShowAddModal(false)
                    }
                    onSubmit={handleDataUpdate}
                    storeEmail={storeEmail}
                />
            )}

            {showEditModal && selectedMaintenance && (
                <EditMaintenanceModal
                    maintenance={selectedMaintenance}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedMaintenance(null);
                    }}
                    onUpdate={handleDataUpdate}
                />
            )}
        </div>
    );
}