import React, { useState, useEffect } from 'react';
import { UserCog, Users, X, Smile, Star, Zap, Coffee, Ghost, Crown } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, updateProfile } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';

// --- Inicialização do Firebase (Integrada) ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Constantes e Utilitários (Integrados) ---
const MASCOTS = [
    { id: 'smile', icon: Smile, color: 'bg-yellow-100 text-yellow-600', label: 'Alegre' },
    { id: 'star', icon: Star, color: 'bg-purple-100 text-purple-600', label: 'Estrela' },
    { id: 'zap', icon: Zap, color: 'bg-blue-100 text-blue-600', label: 'Energia' },
    { id: 'coffee', icon: Coffee, color: 'bg-orange-100 text-orange-600', label: 'Café' },
    { id: 'ghost', icon: Ghost, color: 'bg-gray-100 text-gray-600', label: 'Fantasma' },
    { id: 'crown', icon: Crown, color: 'bg-red-100 text-red-600', label: 'Rei' },
];

// --- Componente Principal ---
const TeamManager = ({ user }) => {
    const [team, setTeam] = useState([]);
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    // Se o photoURL não for um dos mascotes, usa o primeiro como padrão ou vazio
    const [selectedMascot, setSelectedMascot] = useState(user?.photoURL || 'smile');

    useEffect(() => {
        if (!user) return;
        // Caminho estrito: artifacts/{appId}/users/{userId}/team
        const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'team'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTeam(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (user?.displayName) setDisplayName(user.displayName);
        if (user?.photoURL) setSelectedMascot(user.photoURL);
    }, [user]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { 
                    displayName: displayName,
                    photoURL: selectedMascot
                });
                alert("Perfil atualizado com sucesso!");
            }
        } catch (error) {
            console.error("Erro update profile:", error);
            alert("Erro ao atualizar perfil.");
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        if(!email) return;
        try {
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'team'), {
                email,
                role: 'collaborator',
                addedAt: serverTimestamp()
            });
            alert(`Convite enviado com sucesso para ${email}.\n\n(Simulação: Link enviado por e-mail)`);
            setEmail('');
        } catch (error) {
            console.error("Error adding member", error);
            alert("Erro ao adicionar membro.");
        }
    };

    const handleRemoveMember = async (id) => {
        // Nota: window.confirm para simplicidade
        if(window.confirm("Remover acesso deste colaborador?")) {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'team', id));
            } catch (error) {
                console.error("Erro ao remover:", error);
            }
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
            {/* Admin Profile */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><UserCog size={20}/> Meu Perfil</h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    
                    {/* Mascot Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Escolha seu Avatar</label>
                        <div className="flex gap-4 mb-4 flex-wrap">
                            {MASCOTS.map(mascot => {
                                const Icon = mascot.icon;
                                const isSelected = selectedMascot === mascot.id;
                                return (
                                    <button
                                        key={mascot.id}
                                        type="button"
                                        onClick={() => setSelectedMascot(mascot.id)}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${mascot.color} ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                                        title={mascot.label}
                                    >
                                        <Icon size={24} />
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Nome de Exibição</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={displayName} 
                            onChange={e => setDisplayName(e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">E-mail (Login)</label>
                        <input 
                            type="text" 
                            disabled 
                            className="w-full p-2 border rounded-lg bg-slate-50 text-slate-500" 
                            value={user?.email || ''} 
                        />
                    </div>
                    <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 font-medium transition-colors">
                        Salvar Alterações
                    </button>
                </form>
            </div>

            {/* Team Management */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Users size={20}/> Gestão de Colaboradores</h3>
                <p className="text-sm text-slate-500 mb-4">Adicione e-mails de pessoas autorizadas para colaborar no sistema.</p>
                
                <form onSubmit={handleAddMember} className="flex gap-2 mb-6">
                    <input 
                        type="email" 
                        required 
                        placeholder="email@colaborador.com" 
                        className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors">
                        Enviar Convite
                    </button>
                </form>

                <div className="space-y-2">
                    {team.map(member => (
                        <div key={member.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                    {member.email.charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-slate-700">{member.email}</span>
                            </div>
                            <button 
                                onClick={() => handleRemoveMember(member.id)} 
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                title="Remover acesso"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                    {team.length === 0 && (
                        <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                             <Users size={32} className="mx-auto text-slate-300 mb-2"/>
                             <p className="text-sm text-slate-400">Nenhum colaborador cadastrado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeamManager;