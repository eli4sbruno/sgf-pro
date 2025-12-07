import { auth, db, appId } from '../firebase';
import { db, appId } from '../firebase';
import React, { useState, useEffect } from 'react';
import { Plus, Clock, Trash2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';



// Função utilitária para formatar moeda
const formatCurrency = (value) => {
    const number = parseFloat(value);
    if (isNaN(number)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
};

// --- Componente Principal ---

const InventoryManager = ({ user }) => {
    const [products, setProducts] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', cost: '', margin: '', time: '', quantity: '' });

    useEffect(() => {
        if (!user) return;
        // Caminho estrito: artifacts/{appId}/users/{userId}/inventory
        const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'inventory'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [user]);

    const calculateFinalPrice = (cost, margin) => {
        const c = parseFloat(cost) || 0;
        const m = parseFloat(margin) || 0;
        return c + (c * (m / 100));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!user) return;

        try {
            const finalPrice = calculateFinalPrice(formData.cost, formData.margin);
            const quantity = formData.quantity ? parseInt(formData.quantity) : 0;
            
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'inventory'), {
                ...formData,
                quantity,
                finalPrice,
                createdAt: serverTimestamp()
            });
            setShowForm(false);
            setFormData({ name: '', cost: '', margin: '', time: '', quantity: '' });
        } catch (error) {
            console.error("Erro ao salvar produto", error);
        }
    };

    const handleDelete = async (id) => {
        // Nota: window.confirm é usado aqui pois estamos no navegador
        // Em um app React maior, prefira um modal customizado
        if(window.confirm("Remover este item do estoque?")) {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', id));
            } catch (error) {
                console.error("Erro ao deletar", error);
            }
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Estoque e Serviços</h2>
                <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
                    <Plus size={18} /> Novo Item
                </button>
            </div>
            
            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 mb-6">
                    <h3 className="font-bold mb-4 text-slate-700">Cadastro de Produto/Serviço</h3>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Item</label>
                            <input 
                                required 
                                type="text" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Custo (R$)</label>
                            <input 
                                required 
                                type="number" 
                                step="0.01" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={formData.cost} 
                                onChange={e => setFormData({...formData, cost: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Margem de Lucro (%)</label>
                            <input 
                                required 
                                type="number" 
                                step="0.1" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={formData.margin} 
                                onChange={e => setFormData({...formData, margin: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade (Opcional)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={formData.quantity} 
                                onChange={e => setFormData({...formData, quantity: e.target.value})} 
                                placeholder="0" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tempo (min/horas)</label>
                            <input 
                                type="text" 
                                placeholder="Ex: 2 horas" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={formData.time} 
                                onChange={e => setFormData({...formData, time: e.target.value})} 
                            />
                        </div>
                        
                        <div className="md:col-span-2 mt-2">
                            <div className="bg-green-50 text-green-800 p-3 rounded-lg w-full flex justify-between items-center border border-green-200">
                                <span className="text-sm font-medium">Preço Final Sugerido:</span>
                                <span className="font-bold text-xl">{formatCurrency(calculateFinalPrice(formData.cost, formData.margin))}</span>
                            </div>
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                            <button 
                                type="button" 
                                onClick={() => setShowForm(false)} 
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-colors font-bold"
                            >
                                Salvar Item
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="p-4">Item</th>
                                <th className="p-4">Custo</th>
                                <th className="p-4">Margem</th>
                                <th className="p-4">Estoque</th>
                                <th className="p-4">Tempo</th>
                                <th className="p-4">Preço Final</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-medium text-slate-900">{p.name}</td>
                                    <td className="p-4">{formatCurrency(p.cost)}</td>
                                    <td className="p-4">
                                        <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">
                                            {p.margin}%
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {p.quantity > 0 ? (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold inline-flex items-center gap-1">
                                                {p.quantity} un
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs italic">Sem estoque</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <Clock size={14} className="text-slate-400"/> 
                                            {p.time || '-'}
                                        </div>
                                    </td>
                                    <td className="p-4 font-bold text-green-600 text-base">{formatCurrency(p.finalPrice)}</td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleDelete(p.id)} 
                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all"
                                            title="Excluir item"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="bg-slate-50 p-3 rounded-full">
                                                <Plus size={24} className="text-slate-300" />
                                            </div>
                                            <p>Nenhum item cadastrado no estoque.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InventoryManager;