// src/components/RefundConfirmationModal.tsx

import React, { useState } from "react";
import { Undo2, X } from "lucide-react";

import { doc, runTransaction, increment } from "firebase/firestore";
import { db } from "../lib/firebase";

interface RefundConfirmationModalProps {
    saleId: string | null;
    onClose: () => void;
    onRefundSuccess: (saleId: string) => void;
}

const RefundConfirmationModal: React.FC<RefundConfirmationModalProps> = ({
    saleId,
    onClose,
    onRefundSuccess
}) => {
    const [loading, setLoading] = useState(false);

    if (!saleId) return null;

    const handleConfirmRefund = async () => {
        if (loading || !saleId) return;

        setLoading(true);

<<<<<<< Updated upstream
        const saleRef = doc(db, "sales", saleId);

        try {
        

            // Se a transação foi bem-sucedida, chama a callback e fecha o modal.
            onRefundSuccess(saleId);
            onClose();

        } catch (error) {
            // Se a transação falhar (ex: erro de permissão, erro de rede), o catch é acionado.
            alert("Erro ao processar reembolso. Verifique as regras de segurança do Firebase e se o ID da venda está correto.");
=======
        const currentSaleId = saleId;
        const saleRef = doc(db, "sales", currentSaleId);

        try {
            await runTransaction(db, async (transaction) => {
                const saleSnap = await transaction.get(saleRef);

                if (!saleSnap.exists()) {
                    throw new Error("Venda não encontrada.");
                }

                const saleData = saleSnap.data() as any;

                if (saleData.status === "refunded") {
                    throw new Error("Venda já reembolsada.");
                }

                for (const item of saleData.items || []) {
                    const productId = item.id;
                    const refundedQty = Number(item.saleQty) || 0;

                    if (
                        productId &&
                        refundedQty > 0 &&
                        !String(productId).includes("avulso")
                    ) {
                        const productRef = doc(db, "products", productId);

                        transaction.update(productRef, {
                            stock: increment(refundedQty),
                        });
                    }
                }

                transaction.update(saleRef, {
                    status: "refunded",
                });
            });

            onRefundSuccess(currentSaleId);
            onClose();

        } catch (error: any) {
>>>>>>> Stashed changes
            console.error("Erro ao processar reembolso e ajustar estoque:", error);

            if (error?.code === "resource-exhausted") {
                alert("Limite do Firebase excedido. Aguarde alguns minutos e tente novamente.");
            } else {
                alert(error?.message || "Erro ao processar reembolso.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-red-700 rounded-xl w-full max-w-sm p-6 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1"
                    title="Fechar"
                    disabled={loading}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center">
                    <Undo2 className="w-10 h-10 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">
                        Confirmar Reembolso
                    </h2>
                    <p className="text-slate-400 mb-6 text-sm">
                        Tem certeza que deseja reembolsar a transação{" "}
                        <strong>{saleId}</strong>? O estoque dos itens vendidos será restaurado.
                    </p>
                </div>

                <div className="flex justify-between gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                        disabled={loading}
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirmRefund}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || !saleId}
                    >
                        {loading ? "Processando..." : "Confirmar Reembolso"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefundConfirmationModal;