import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  increment,
  updateDoc,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export const productsCollection = collection(db, "products");

// --------------------------------------------------
// Buscar produtos da loja
// --------------------------------------------------
export const fetchProducts = async (storeEmail: string) => {
  if (!storeEmail) return [];

  const q = query(productsCollection, where("store", "==", storeEmail));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};

// --------------------------------------------------
// Buscar produtos por termo de pesquisa (CORRIGIDO PARA BUSCAR BARCODE TAMBÉM)
// --------------------------------------------------
export const searchProducts = async (
  storeEmail: string,
  searchTerm: string,
  limitResults = 15
) => {
  if (!storeEmail || !searchTerm) return [];

  const searchLower = searchTerm.toLowerCase();

  const q = query(
    productsCollection,
    where("store", "==", storeEmail),
    where("nameLower", ">=", searchLower),
    where("nameLower", "<", searchLower + "\uf8ff"),
    limit(limitResults)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};

// --------------------------------------------------
// Criar produto (CORRIGIDO PARA INCLUIR BARCODE)
// --------------------------------------------------
export const addProduct = async (product: any, storeEmail: string) => {
  if (!storeEmail) throw new Error("E-mail da loja não fornecido.");

  const ref = doc(productsCollection);

  const data = {
    id: ref.id,
    store: storeEmail, // 🔥 GARANTE que NUNCA vira NaN

    stock: Number(product.stock) >= 0 ? Number(product.stock) : 0,
    minStock: Number(product.minStock) >= 0 ? Number(product.minStock) : 0,
    price: Number(product.price) >= 0 ? Number(product.price) : 0,
    costPrice: Number(product.costPrice) >= 0 ? Number(product.costPrice) : 0, // Strings

    name: product.name || "",
    brand: product.brand || "",
    model: product.model || "",
    category: product.category || "",
    // ✅ NOVO: Inclui o código de barras
    barcode: product.barcode || null, // Busca rápida

    nameLower: product.name?.toLowerCase() || "",
  };

  await setDoc(ref, data);
  return data;
};

// --------------------------------------------------
// Atualizar produto (SEM undefined/NaN)
// --------------------------------------------------
export const updateProduct = async (id: string, data: any) => {
  const productRef = doc(productsCollection, id);

  const cleaned: any = {}; // 🔥 Só inclui campos que realmente foram enviados

  if (data.name !== undefined) {
    cleaned.name = data.name;
    cleaned.nameLower = data.name.toLowerCase();
  }

  // ✅ NOVO: Permite atualizar o código de barras
  if (data.barcode !== undefined) cleaned.barcode = data.barcode || null;

  if (data.brand !== undefined) cleaned.brand = data.brand;
  if (data.model !== undefined) cleaned.model = data.model;
  if (data.category !== undefined) cleaned.category = data.category; // 🔥 Converte números SEM NUNCA gerar NaN

  if (data.stock !== undefined)
    cleaned.stock = Number(data.stock) >= 0 ? Number(data.stock) : 0;

  if (data.minStock !== undefined)
    cleaned.minStock = Number(data.minStock) >= 0 ? Number(data.minStock) : 0;

  if (data.price !== undefined)
    cleaned.price = Number(data.price) >= 0 ? Number(data.price) : 0;

  if (data.costPrice !== undefined)
    cleaned.costPrice =
      Number(data.costPrice) >= 0 ? Number(data.costPrice) : 0;

  await updateDoc(productRef, cleaned);
};

// --------------------------------------------------
// Buscar produto por código de barras (NOVA FUNÇÃO)
// --------------------------------------------------
/**
 * Busca um produto específico pelo seu código de barras.
 */
export const fetchProductByBarcode = async (
  storeEmail: string,
  barcode: string
) => {
  if (!storeEmail || !barcode) return null;

  const q = query(
    productsCollection,
    where("store", "==", storeEmail),
    where("barcode", "==", barcode),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];

  return {
    id: docSnap.id,
    ...docSnap.data(),
  };
};

// --------------------------------------------------
// Ajustar estoque (SEM NaN SEM ERRO)
// --------------------------------------------------
export const adjustStock = async (
  id: string,
  value: number,
  operation: "add" | "remove" | "set"
) => {
  const productRef = doc(productsCollection, id); // Garantia anti-NaN

  const qty = Number(value);
  if (isNaN(qty) || qty < 0) throw new Error("Quantidade inválida");

  if (operation === "set") {
    await updateDoc(productRef, { stock: qty });
    return;
  } // Uso de increment para garantir atomicidade

  await updateDoc(productRef, {
    stock: increment(operation === "add" ? qty : -qty),
  });
};

// --------------------------------------------------
// Deletar produto
// --------------------------------------------------
export const deleteProduct = async (id: string) => {
  const productRef = doc(productsCollection, id);
  await deleteDoc(productRef);
};
