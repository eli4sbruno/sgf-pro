import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
// ATUALIZADO: Importa a autenticação já configurada do arquivo central
import { auth } from '../firebase';

const AuthScreen = () => {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (e) { setError("Erro no login Google: " + e.message); }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (mode === 'register') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                await sendEmailVerification(userCredential.user);
                alert("Conta criada! Verifique seu e-mail.");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-blue-600 p-8 text-center text-white">
                    <h1 className="text-2xl font-bold mb-1">SGF Integrado</h1>
                    <p className="text-blue-100 opacity-80">Gestão Profissional</p>
                </div>
                <div className="p-8">
                    <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setMode('login')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${mode === 'login' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Login</button>
                        <button onClick={() => setMode('register')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${mode === 'register' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Criar Conta</button>
                    </div>

                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        {mode === 'register' && (
                            <input required type="text" placeholder="Nome Completo" className="w-full p-3 border rounded-lg" value={name} onChange={e => setName(e.target.value)} />
                        )}
                        <input required type="email" placeholder="E-mail" className="w-full p-3 border rounded-lg" value={email} onChange={e => setEmail(e.target.value)} />
                        <input required type="password" placeholder="Senha" className="w-full p-3 border rounded-lg" value={password} onChange={e => setPassword(e.target.value)} />
                        
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">
                            {mode === 'login' ? 'Entrar' : 'Cadastrar'}
                        </button>
                    </form>

                    <div className="my-6 flex items-center">
                        <div className="flex-grow border-t"></div>
                        <span className="mx-4 text-xs text-slate-400">OU</span>
                        <div className="flex-grow border-t"></div>
                    </div>

                    <button onClick={handleGoogle} className="w-full border py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2">
                        <Mail size={18}/> Continuar com Google
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;