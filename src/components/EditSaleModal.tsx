// components/EditSaleModal.tsx
import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface SaleWithClient {
    id: string;
    total: number;
    payment: string;
    // outros campos...
}

interface EditSaleModalProps {
    sale: SaleWithClient | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

const paymentOptions = ["PIX", "CARTÃO", "DINHEIRO", "Fiado"];

export default function EditSaleModal({ sale, isOpen, onClose, onSave }: EditSaleModalProps) {
    const [formData, setFormData] = useState({
        total: 0,
        payment: "",
    });

    useEffect(() => {
        if (sale) {
            setFormData({
                total: sale.total,
                payment: sale.payment,
            });
        }
    }, [sale]);

    const handleSave = async () => {
        if (!sale) return;

        try {
            const saleRef = doc(db, "sales", sale.id);
            await updateDoc(saleRef, {
                total: Number(formData.total),
                paymentMethod: formData.payment,
                // opcional: updatedAt: new Date()
            });

            onSave(); // recarrega a lista
            onClose();
        } catch (error) {
            console.error("Erro ao atualizar venda:", error);
            alert("Erro ao salvar alterações");
        }
    };

    if (!isOpen || !sale) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <h2 className="text-xl font-black text-white">Editar Venda</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Valor Total */}
                    <div>
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1 block">
                            Valor Total (R$)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.total}
                            onChange={(e) => setFormData({ ...formData, total: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-2xl font-black text-white focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    {/* Forma de Pagamento */}
                    <div>
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">
                            Forma de Pagamento
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {paymentOptions.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setFormData({ ...formData, payment: option })}
                                    className={`py-3 px-4 rounded-2xl font-bold text-sm transition-all border ${
                                        formData.payment === option
                                            ? "bg-emerald-500 text-black border-emerald-500"
                                            : "bg-slate-800 border-slate-700 hover:border-slate-600"
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 font-bold text-slate-400 hover:text-white border border-slate-700 rounded-2xl"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <Save size={20} />
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
}