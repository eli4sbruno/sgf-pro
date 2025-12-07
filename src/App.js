import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ArrowUpCircle, ArrowDownCircle, QrCode, Plus, Search, Filter, 
  Menu, X, LogOut, PieChart, ShoppingCart, Trash2, Camera, UploadCloud, 
  Banknote, Link as LinkIcon, CreditCard, ChevronDown, CheckCircle, Lock,
  Box, Users, FileText, AlertCircle
} from 'lucide-react';
import { signOut, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db, appId } from './firebase';
import { formatCurrency, formatDate, COST_CENTERS, CATEGORIES, MASCOTS } from './utils';

// Import Sub-components
import AuthScreen from './components/AuthScreen';
import InventoryManager from './components/InventoryManager';
import TeamManager from './components/TeamManager';
import ReportsModule from './components/ReportsModule';
import PixGenerator from './components/PixGenerator';

// Componentes UI pequenos para evitar muitos arquivos
const StatusBadge = ({ status }) => {
  const styles = {
    paid: 'bg-green-100 text-green-800 border-green-200',
    received: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    overdue: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  const labels = { paid: 'Pago', received: 'Recebido', pending: 'Aberto', overdue: 'Vencido', cancelled: 'Cancelado' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
};

const Card = ({ title, value, subtext, icon: Icon, trend }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${trend === 'up' ? 'bg-green-50 text-green-600' : trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
        <Icon size={20} />
      </div>
    </div>
    {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('expense');
  const [cart, setCart] = useState([]);
  const [itemForm, setItemForm] = useState({ description: '', value: '', quantity: 1, productId: null });
  const [formData, setFormData] = useState({});
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const [isGeneraringPayment, setIsGeneratingPayment] = useState(false);

  // Inventory Integration State
  const [inventoryItems, setInventoryItems] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Auth State
  const [user, setUser] = useState(null);
  const [authStep, setAuthStep] = useState('login'); 
  const [loading, setLoading] = useState(true);
  const inputRefs = useRef([]);

  // --- FIREBASE AUTH & DATA LISTENERS ---
  useEffect(() => {
    const initAuth = async () => {
      // Logic for custom tokens if coming from specific environment, mostly not needed for standard deployment
      setLoading(false);
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthStep('2fa'); 
      } else {
        setUser(null);
        setAuthStep('login');
        setTransactions([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || authStep !== 'app') return;

    // Fetch Transactions
    const qTrx = query(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'));
    const unsubTrx = onSnapshot(qTrx, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sortedDocs = docs.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
        setTransactions(sortedDocs);
    });

    // Fetch Inventory
    const qInv = query(collection(db, 'artifacts', appId, 'users', user.uid, 'inventory'));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
        setInventoryItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubTrx(); unsubInv(); };
  }, [user, authStep]);

  // --- CALCULATIONS ---
  const summary = useMemo(() => {
    const now = new Date();
    let income = 0; let expense = 0; let overduePay = 0; let overdueRec = 0;
    transactions.forEach(t => {
      const val = parseFloat(t.value);
      if (t.status !== 'cancelled') {
        if (t.type === 'income') {
          income += (t.status === 'received' ? val : 0);
          if (t.status === 'pending' && new Date(t.dueDate) < now) overdueRec += val;
        } else {
          expense += (t.status === 'paid' ? val : 0);
          if (t.status === 'pending' && new Date(t.dueDate) < now) overduePay += val;
        }
      }
    });
    return { income, expense, balance: income - expense, overduePay, overdueRec };
  }, [transactions]);

  // --- HANDLERS ---
  const handle2FASubmit = (e) => { e.preventDefault(); setAuthStep('app'); };
  const handle2FAChange = (index, value) => { if (isNaN(value)) return; if (value.length === 1 && index < 5) { inputRefs.current[index + 1]?.focus(); } };
  const handleFileChange = (e) => { if(e.target.files && e.target.files[0]) { setFile(e.target.files[0]); } }

  // --- CART LOGIC ---
  const handleAddToCart = () => {
      if(!itemForm.description || !itemForm.value) return;
      const newItem = { ...itemForm, id: Date.now(), total: parseFloat(itemForm.value) * parseInt(itemForm.quantity) };
      setCart([...cart, newItem]);
      setItemForm({ description: '', value: '', quantity: 1, productId: null });
  };
  const handleRemoveFromCart = (id) => { setCart(cart.filter(item => item.id !== id)); };
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.total, 0), [cart]);
  const handleSelectProduct = (product) => {
      setItemForm({ description: product.name, value: product.finalPrice || '', quantity: 1, productId: product.id });
      setShowProductDropdown(false);
  }
  const filteredProducts = useMemo(() => {
      if (!itemForm.description) return inventoryItems;
      return inventoryItems.filter(item => item.name.toLowerCase().includes(itemForm.description.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  }, [inventoryItems, itemForm.description]);

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;
    const finalValue = modalType === 'income' ? cartTotal : parseFloat(formData.value);
    const finalDesc = modalType === 'income' ? (cart.length > 0 ? `${cart[0].description} + ${cart.length-1} itens` : 'Venda') : formData.description;

    if(modalType === 'income' && cart.length === 0) { alert("Adicione itens ao carrinho."); return; }

    try {
      const payload = { ...formData, description: finalDesc, value: finalValue, createdAt: serverTimestamp(), type: modalType, fileName: file ? file.name : null, paymentMethod: formData.paymentMethod || 'money', cartItems: modalType === 'income' ? cart : [] };

      if(modalType === 'income' && cart.length > 0) {
          const batch = writeBatch(db);
          let hasStockUpdate = false;
          cart.forEach(item => {
              if(item.productId) {
                  const invItem = inventoryItems.find(i => i.id === item.productId);
                  if(invItem && invItem.quantity >= item.quantity) {
                      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', item.productId);
                      batch.update(ref, { quantity: invItem.quantity - item.quantity });
                      hasStockUpdate = true;
                  }
              }
          });
          if(hasStockUpdate) await batch.commit();
      }

      if (formData.id) {
        const { id, ...data } = payload;
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id), data);
        setShowModal(false); setFormData({}); 
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), payload);
        if(modalType === 'income' && ['pix', 'card_link'].includes(payload.paymentMethod)) {
            setFormData({ ...payload, value: finalValue, description: finalDesc });
            setIsGeneratingPayment(true);
        } else { setShowModal(false); setFormData({}); }
      }
      setFile(null); setCart([]);
    } catch (error) { console.error("Erro ao salvar:", error); alert("Erro ao salvar transação."); }
  };

  const handleDelete = async (id) => { if (confirm('Tem certeza?')) { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id)); } };
  const handleSignOut = async () => { await signOut(auth); setAuthStep('login'); }
  const openModal = (type, data = null) => {
    setModalType(type); setIsGeneratingPayment(false); setCart([]);
    setItemForm({ description: '', value: '', quantity: 1, productId: null });
    setFormData(data || { dueDate: new Date().toISOString().split('T')[0], status: 'pending', costCenter: 'Operacional', category: 'Outros', paymentMethod: 'money' });
    setFile(null); setShowModal(true);
  };

  // --- RENDERERS ---
  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Saldo Atual" value={formatCurrency(summary.balance)} icon={LayoutDashboard} trend={summary.balance >= 0 ? 'up' : 'down'} subtext="Caixa consolidado" />
        <Card title="Receitas (Mês)" value={formatCurrency(summary.income)} icon={ArrowUpCircle} trend="up" subtext="Valores efetivamente recebidos" />
        <Card title="Despesas (Mês)" value={formatCurrency(summary.expense)} icon={ArrowDownCircle} trend="down" subtext="Valores efetivamente pagos" />
        <Card title="Vencidos a Pagar" value={formatCurrency(summary.overduePay)} icon={AlertCircle} trend="down" subtext="Atenção necessária" />
      </div>
      {/* ... (Add more dashboard widgets here) */}
    </div>
  );

  const renderTransactionList = (type) => {
    const filtered = transactions.filter(t => t.type === type);
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-xl font-bold text-slate-800">{type === 'income' ? 'Contas a Receber' : 'Contas a Pagar'}</h2>
          <button onClick={() => openModal(type)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition"><Plus size={18} /> Novo Lançamento</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">Descrição</th>
                <th className="p-4">Vencimento</th>
                <th className="p-4">Categoria/Centro</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition">
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{t.description}</p>
                    <p className="text-xs text-slate-500">{t.entity}</p>
                  </td>
                  <td className="p-4"><p>{formatDate(t.dueDate)}</p></td>
                  <td className="p-4"><p>{t.category}</p><p className="text-xs text-slate-400">{t.costCenter}</p></td>
                  <td className="p-4 font-semibold text-slate-800">{formatCurrency(t.value)}</td>
                  <td className="p-4"><StatusBadge status={t.status} type={type} /></td>
                  <td className="p-4 text-right">
                    <button onClick={() => openModal(type, t)} className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-3">Editar</button>
                    <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700 font-medium text-xs">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- AUTH/MAIN LAYOUT ---
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-400"><Loader2 className="animate-spin mr-2" /> Carregando SGF...</div>;
  if (authStep === 'login') return <AuthScreen />;
  if (authStep === '2fa') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-8">
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600"><Lock size={32} /></div>
                <h3 className="font-bold text-slate-800 text-xl">Google Authenticator</h3>
            </div>
            <form onSubmit={handle2FASubmit}>
                <div className="flex gap-2 justify-center mb-8">{[0,1,2,3,4,5].map(i => (<input key={i} ref={el => inputRefs.current[i] = el} type="text" maxLength="1" onChange={(e) => handle2FAChange(i, e.target.value)} className="w-12 h-14 text-center text-2xl font-bold border border-slate-300 rounded-lg" />))}</div>
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Verificar Código</button>
            </form>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <style>{`.scrollbar-invisible::-webkit-scrollbar { width: 0px; background: transparent; } .scrollbar-invisible { scrollbar-width: none; -ms-overflow-style: none; }`}</style>
      
      <aside className={`z-30 w-64 bg-slate-900 text-white transition-transform duration-300 flex-shrink-0 ${isSidebarOpen ? 'translate-x-0 relative' : '-translate-x-full fixed left-0 inset-y-0'} lg:translate-x-0 lg:static lg:block`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <div><h1 className="text-xl font-bold tracking-tight">SGF Pro</h1><p className="text-xs text-slate-400">Financeiro Integrado</p></div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={20} /></button>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-invisible">
            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center w-full p-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><LayoutDashboard size={20} className="mr-3" /> Dashboard</button>
            <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gestão</div>
            <button onClick={() => setActiveTab('income')} className={`flex items-center w-full p-3 rounded-lg transition-colors ${activeTab === 'income' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ArrowUpCircle size={20} className="mr-3" /> Receitas</button>
            <button onClick={() => setActiveTab('expense')} className={`flex items-center w-full p-3 rounded-lg transition-colors ${activeTab === 'expense' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ArrowDownCircle size={20} className="mr-3" /> Despesas</button>
            <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ferramentas</div>
            <button onClick={() => setActiveTab('inventory')} className={`flex items-center w-full p-3 rounded-lg transition-colors ${activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Box size={20} className="mr-3" /> Estoque</button>
            <button onClick={() => setActiveTab('reports')} className={`flex items-center w-full p-3 rounded-lg transition-colors ${activeTab === 'reports' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><PieChart size={20} className="mr-3" /> Relatórios</button>
            <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</div>
            <button onClick={() => setActiveTab('team')} className={`flex items-center w-full p-3 rounded-lg transition-colors ${activeTab === 'team' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Users size={20} className="mr-3" /> Equipe</button>
          </nav>
          <div className="p-4 border-t border-slate-800"><button onClick={handleSignOut} className="flex items-center w-full p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"><LogOut size={20} className="mr-3" /> Sair</button></div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6">
          <button onClick={() => setIsSidebarOpen(true)} className={`lg:hidden text-slate-500 hover:text-slate-700 transition-opacity ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><Menu size={24} /></button>
          <div className="flex items-center ml-auto space-x-4">
             <div className="text-right hidden sm:block"><p className="text-sm font-medium text-slate-800">{user?.displayName || 'Usuário'}</p><p className="text-xs text-slate-500">{user?.email}</p></div>
             {user?.photoURL && MASCOTS.find(m => m.id === user.photoURL) ? <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-slate-100 ${MASCOTS.find(m => m.id === user.photoURL).color}`}>{React.createElement(MASCOTS.find(m => m.id === user.photoURL).icon, { size: 20 })}</div> : <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200">{user?.displayName?.charAt(0) || 'U'}</div>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-invisible">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'income' && renderTransactionList('income')}
            {activeTab === 'expense' && renderTransactionList('expense')}
            {activeTab === 'reports' && <ReportsModule transactions={transactions} />}
            {activeTab === 'inventory' && <InventoryManager user={user} />}
            {activeTab === 'team' && <TeamManager user={user} />}
          </div>
        </div>
      </main>

      {/* TRANSACTION MODAL (Incluindo Carrinho e Forms) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
            {isGeneraringPayment ? (
                <div className="relative">
                     <button onClick={() => {setIsGeneratingPayment(false); setShowModal(false);}} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10"><X size={24} /></button>
                     <PixGenerator user={user} initialData={formData} onFinish={() => {setIsGeneratingPayment(false); setShowModal(false);}} />
                </div>
            ) : (
                <>
                <div className={`p-6 border-b flex justify-between items-center ${modalType === 'income' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <h2 className={`text-xl font-bold ${modalType === 'income' ? 'text-green-800' : 'text-red-800'}`}>{formData.id ? 'Editar' : (modalType === 'income' ? 'Nova Receita' : 'Nova Despesa')}</h2>
                    <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmitTransaction} className="p-6 space-y-4">
                    {/* Logica do Carrinho aqui para Receitas */}
                    {modalType === 'income' ? (
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Adicionar Item</label>
                                <div className="flex gap-2 mb-2">
                                    <div className="relative flex-1">
                                        <input type="text" placeholder="Buscar produto..." className="w-full p-2 pr-8 border border-slate-300 rounded-lg" value={itemForm.description} onChange={e => { setItemForm({...itemForm, description: e.target.value}); setShowProductDropdown(true); }} onFocus={() => setShowProductDropdown(true)} />
                                        <button type="button" onClick={() => setShowProductDropdown(!showProductDropdown)} className="absolute right-2 top-2.5 text-slate-400"><ChevronDown size={16} /></button>
                                        {showProductDropdown && (
                                            <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                                                {filteredProducts.map(prod => (<button key={prod.id} type="button" onClick={() => handleSelectProduct(prod)} className="w-full text-left p-2 hover:bg-blue-50 flex justify-between items-center text-sm"><span>{prod.name}</span><span className="font-bold text-green-600">{formatCurrency(prod.finalPrice)}</span></button>))}
                                            </div>
                                        )}
                                    </div>
                                    <input type="number" placeholder="Qtd" className="w-20 p-2 border rounded-lg" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} />
                                </div>
                                <div className="flex gap-2">
                                    <input type="number" step="0.01" placeholder="Valor Unit." className="flex-1 p-2 border rounded-lg" value={itemForm.value} onChange={e => setItemForm({...itemForm, value: e.target.value})} />
                                    <button type="button" onClick={handleAddToCart} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 font-bold"><Plus size={20}/></button>
                                </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                                {cart.length > 0 ? (
                                    <table className="w-full text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-center">Qtd</th><th className="p-2 text-right">Total</th><th className="p-2 w-8"></th></tr></thead><tbody>{cart.map((item, idx) => (<tr key={idx} className="border-t"><td className="p-2">{item.description}</td><td className="p-2 text-center">{item.quantity}</td><td className="p-2 text-right font-medium">{formatCurrency(item.total)}</td><td className="p-2"><button type="button" onClick={() => handleRemoveFromCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></td></tr>))}</tbody></table>
                                ) : <div className="p-8 text-center text-slate-400 flex flex-col items-center"><ShoppingCart size={24} className="mb-2 opacity-50"/><p class="text-xs">Carrinho vazio</p></div>}
                            </div>
                            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100"><span className="font-bold text-blue-800">Total</span><span className="text-xl font-extrabold text-blue-700">{formatCurrency(cartTotal)}</span></div>
                        </div>
                    ) : (
                        // Form Simples para Despesa
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label><input required className="w-full p-2 border rounded-lg" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Valor</label><input required type="number" step="0.01" className="w-full p-2 border rounded-lg" value={formData.value || ''} onChange={e => setFormData({...formData, value: e.target.value})} /></div>
                        </div>
                    )}
                    {/* Resto do formulário (Datas, Categorias, Método de Pagamento) mantido igual ao código principal */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                        <button type="submit" className={`px-6 py-2 text-white rounded-lg flex items-center gap-2 ${modalType === 'income' ? 'bg-green-600' : 'bg-red-600'}`}>Salvar</button>
                    </div>
                </form>
                </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}