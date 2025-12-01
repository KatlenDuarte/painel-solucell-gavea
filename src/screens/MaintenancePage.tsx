import React, { useState, useEffect, useCallback } from "react"
import {
  Plus, Search, Filter, Wrench, Clock, CheckCircle, XCircle,
  AlertCircle, Calendar, DollarSign, Package, Phone, User,
  Eye, Trash2, Edit2, Zap, DollarSign as Dollar, Loader
} from 'lucide-react'

// ⚠️ ATUALIZAÇÕES:
// Importar as funções do serviço. Você precisará implementar updateMaintenance no seu service!
import { 
    fetchMaintenances, 
    deleteMaintenance as deleteMaintenanceService,
    // ASSUMIMOS QUE VOCÊ VAI CRIAR ESTA FUNÇÃO NO SEU service/maintenanceService.ts
    updateMaintenance as updateMaintenanceService 
} from '../services/maintenanceService.ts' 

import AddMaintenanceModal from "../components/AddMaintenanceModal"
// RENOMEADO/ATUALIZADO: Este modal agora será responsável por VER e EDITAR.
import EditMaintenanceModal from "../components/EditMaintenanceModal" 

interface Maintenance {
  id: string
  customer: string
  phone: string
  device: string
  brand: string
  model: string
  issue: string
  status: "pending" | "parts_ordered" | "in_progress" | "completed" | "cancelled"
  value: number
  paid: boolean
  partOrdered: boolean
  orderDate?: string
  deliveryDate: string
  createdAt: string
  notes?: string
}

const useAuth = () => ({
  storeEmail: "minha-loja@exemplo.com"
})

const MaintenancePage = () => {
  const { storeEmail } = useAuth()

  const [loading, setLoading] = useState(true)
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false) // NOVO: Estado para o Modal de Edição
  const [selectedMaintenance, setSelectedMaintenance] = useState<Maintenance | null>(null)
  const [quickActionLoadingId, setQuickActionLoadingId] = useState<string | null>(null); // NOVO: Para desabilitar o botão durante a Ação Rápida

  const loadMaintenances = useCallback(async () => {
    if (!storeEmail) {
      console.error("E-mail da loja não disponível para carregar manutenções.")
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchMaintenances(storeEmail)
      setMaintenances(data as Maintenance[])
    } catch (error) {
      console.error("Erro ao carregar manutenções:", error)
    } finally {
      setLoading(false)
    }
  }, [storeEmail])

  useEffect(() => {
    loadMaintenances()
  }, [loadMaintenances])

  useEffect(() => {
    const isModalOpen = showAddModal || showEditModal // Atualizado para showEditModal
    document.body.classList.toggle("no-scroll", isModalOpen)
    return () => document.body.classList.remove("no-scroll")
  }, [showAddModal, showEditModal])

  const statusConfig: { [key in Maintenance['status']]: { label: string, color: string, icon: any } } = {
    pending: { label: "Aguardando", color: "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-300 dark:bg-amber-800/20 dark:border-amber-700/50", icon: Clock },
    parts_ordered: { label: "Peça Pedida", color: "text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-300 dark:bg-blue-800/20 dark:border-blue-700/50", icon: Package },
    in_progress: { label: "Em Reparo", color: "text-purple-600 bg-purple-500/10 border-purple-500/20 dark:text-purple-300 dark:bg-purple-800/20 dark:border-purple-700/50", icon: Wrench },
    completed: { label: "Concluído", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-800/20 dark:border-emerald-700/50", icon: CheckCircle },
    cancelled: { label: "Cancelado", color: "text-red-600 bg-red-500/10 border-red-500/20 dark:text-red-300 dark:bg-red-800/20 dark:border-red-700/50", icon: XCircle }
  }

  const filteredMaintenances = maintenances
    .filter(m => {
      const term = searchTerm.toLowerCase()
      const matchesSearch =
        m.customer.toLowerCase().includes(term) ||
        m.device.toLowerCase().includes(term) ||
        m.issue.toLowerCase().includes(term)

      const matchesStatus = statusFilter === "all" || m.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      // Converte as strings de data/hora para objetos Date e subtrai.
      // b.createdAt - a.createdAt resulta em ordem decrescente (mais recente primeiro).
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

  // ✏️ FUNÇÃO PARA ABRIR O MODAL DE EDIÇÃO
  const openEditModal = (m: Maintenance) => {
    setSelectedMaintenance(m)
    setShowEditModal(true)
  }

  // 📥 CALLBACK APÓS ADIÇÃO OU EDIÇÃO
  const handleDataUpdate = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    loadMaintenances()
  }

  // 🗑️ FUNÇÃO PARA DELETAR
  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta manutenção? Esta ação é irreversível.")) {
      try {
        await deleteMaintenanceService(id)
        loadMaintenances()
      } catch (error) {
        console.error("Erro ao deletar manutenção:", error)
        alert("Erro ao tentar deletar a manutenção.")
      }
    }
  }

  // ⚡ AÇÃO RÁPIDA: Marcar/Desmarcar como Pago
  const togglePaidStatus = async (maintenance: Maintenance) => {
    setQuickActionLoadingId(maintenance.id);
    const newPaidStatus = !maintenance.paid;

    try {
        await updateMaintenanceService(maintenance.id, { paid: newPaidStatus });
        
        // Atualiza a lista localmente para feedback instantâneo (sem recarregar tudo)
        setMaintenances(prev => 
            prev.map(m => m.id === maintenance.id ? { ...m, paid: newPaidStatus } : m)
        );

    } catch (error) {
        console.error("Erro ao atualizar status de pagamento:", error);
        alert("Erro ao atualizar o status de pagamento.");
    } finally {
        setQuickActionLoadingId(null);
    }
  }

  // ⚡ AÇÃO RÁPIDA: Mudar Status para o próximo (Ex: Pending -> In Progress)
  // Nota: Isso é um exemplo simplificado, você pode querer implementar um seletor no modal.
  const advanceStatus = async (maintenance: Maintenance) => {
    const statusOrder: Maintenance['status'][] = [
        "pending", 
        "parts_ordered", 
        "in_progress", 
        "completed"
    ];

    if (maintenance.status === "cancelled" || maintenance.status === "completed") {
        alert("Não é possível avançar o status de uma manutenção Cancelada ou Concluída.");
        return;
    }

    const currentIndex = statusOrder.indexOf(maintenance.status);
    const nextIndex = currentIndex + 1;

    if (nextIndex < statusOrder.length) {
        setQuickActionLoadingId(maintenance.id);
        const newStatus = statusOrder[nextIndex];

        try {
            await updateMaintenanceService(maintenance.id, { status: newStatus });
            
            // Atualiza a lista localmente
            setMaintenances(prev => 
                prev.map(m => m.id === maintenance.id ? { ...m, status: newStatus } : m)
            );
        } catch (error) {
            console.error("Erro ao avançar o status:", error);
            alert("Erro ao avançar o status da manutenção.");
        } finally {
            setQuickActionLoadingId(null);
        }
    }
  }


  return (
    <div className="p-4 sm:p-8 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold dark:text-white">Manutenções</h1>
          <p className="text-slate-600 dark:text-slate-400">Gerencie serviços de reparo</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg flex items-center gap-2 shadow hover:bg-emerald-600 transition"
        >
          <Plus /> Nova Manutenção
        </button>
      </div>

      ---

      {/* SEARCH + FILTERS */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, aparelho ou problema..."
              className="w-full pl-12 pr-4 py-3 rounded-lg bg-slate-50 border dark:bg-slate-700 dark:text-white dark:border-slate-600 focus:ring-emerald-500 focus:border-emerald-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-lg bg-slate-50 border dark:bg-slate-700 dark:text-white dark:border-slate-600 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">Todos os Status</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      ---

      {/* LISTA DE MANUTENÇÕES */}
      {loading && (
        <div className="text-center py-8 dark:text-slate-400">
          <Wrench className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
          Carregando manutenções...
        </div>
      )}

      {!loading && filteredMaintenances.length === 0 && (
        <div className="text-center py-8 border rounded-xl bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="dark:text-slate-300">Nenhuma manutenção encontrada.</p>
        </div>
      )}

      {!loading && filteredMaintenances.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Aparelho</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Problema</th>
                <th className="px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Status</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Entrega</th>
                <th className="px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Valor / Pago</th>
                <th className="px-4 py-3 text-center text-xs font-semibold dark:text-slate-400">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-slate-700">
              {filteredMaintenances.map(m => {
                const StatusIcon = statusConfig[m.status].icon
                const isLoading = quickActionLoadingId === m.id;

                return (
                  <tr key={m.id} className="dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-medium">{m.customer}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{m.phone}</p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium">{m.device}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{m.brand}</p>
                    </td>

                    <td className="hidden md:table-cell px-4 py-4 max-w-[180px] truncate">
                      {m.issue}
                    </td>

                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs border rounded-full inline-flex items-center gap-1 ${statusConfig[m.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[m.status].label}
                      </span>
                    </td>

                    <td className="hidden md:table-cell px-4 py-4 text-slate-700 dark:text-slate-300">
                      {m.deliveryDate ? new Date(m.deliveryDate).toLocaleDateString("pt-BR") : "-"}
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold dark:text-white">
                        R$ {m.value.toFixed(2)}
                      </p>
                      {/* Botão de Ação Rápida: Pagar/Desmarcar */}
                      <button 
                        onClick={() => togglePaidStatus(m)}
                        disabled={isLoading}
                        className={`text-xs font-semibold rounded-full p-1 transition-colors mt-1 inline-flex items-center gap-1 ${
                            m.paid 
                                ? "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/50 hover:bg-emerald-200" 
                                : "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50 hover:bg-amber-200"
                        } disabled:opacity-50`}
                      >
                        {isLoading ? (
                            <Loader className="w-3 h-3 animate-spin" />
                        ) : m.paid ? (
                            <>
                                <CheckCircle className="w-3 h-3" /> Pago
                            </>
                        ) : (
                            <>
                                <Dollar className="w-3 h-3" /> Pagar
                            </>
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-center gap-2">
                        {/* Botão de Ação Rápida: Avançar Status */}
                        {!['completed', 'cancelled'].includes(m.status) && (
                            <button 
                                title="Avançar Status"
                                onClick={() => advanceStatus(m)}
                                disabled={isLoading}
                                className="p-2 hover:bg-blue-100 rounded dark:hover:bg-blue-800/50 disabled:opacity-50 transition"
                            >
                                <Zap className="w-4 h-4 text-blue-500" />
                            </button>
                        )}

                        {/* Botão de Edição (Abre o modal de edição) */}
                        <button 
                            title="Editar Manutenção"
                            className="p-2 hover:bg-slate-100 rounded dark:hover:bg-slate-700" 
                            onClick={() => openEditModal(m)}
                        >
                          <Edit2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </button>
                        
                        {/* Botão de Deletar */}
                        <button 
                            title="Excluir Manutenção"
                            className="p-2 hover:bg-red-100 rounded dark:hover:bg-red-800/50" 
                            onClick={() => handleDelete(m.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      ---

      {/* MODAIS */}

      {showAddModal && (
        <AddMaintenanceModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleDataUpdate} // Usa o callback genérico
          storeEmail={storeEmail}
        />
      )}

      {showEditModal && selectedMaintenance && (
        <EditMaintenanceModal
          maintenance={selectedMaintenance}
          onClose={() => {
            setShowEditModal(false)
            setSelectedMaintenance(null)
          }}
          onUpdate={handleDataUpdate} // Novo callback para recarregar após edição
        />
      )}

    </div>
  )
}

export default MaintenancePage