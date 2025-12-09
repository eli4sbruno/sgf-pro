import { db, appId } from '../firebase';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QrCode, Copy, Share2, Settings, X, Loader2, RefreshCw, Link as LinkIcon, Lock, Save } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';


// --- Funções Utilitárias (Integradas) ---

const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    const number = parseFloat(value);
    if (isNaN(number)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
};

// Função simplificada para gerar Payload Pix (EMV QRCPS)
const generatePixPayload = (key, value, description, name, city) => {
    // Funções auxiliares para montar o TLV (Tag-Length-Value)
    const formatField = (id, value) => {
        const val = value.toString();
        const len = val.length.toString().padStart(2, '0');
        return `${id}${len}${val}`;
    };

    const normalizeText = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const payloadName = normalizeText(name || 'Recebedor').substring(0, 25);
    const payloadCity = normalizeText(city || 'Cidade').substring(0, 15);
    const payloadKey = key || '';
    const payloadDesc = normalizeText(description || '').substring(0, 20);
    const amount = parseFloat(value).toFixed(2);

    // Montagem dos campos do Pix
    let payload = [
        formatField('00', '01'), // Payload Format Indicator
        formatField('26', [      // Merchant Account Information
            formatField('00', 'br.gov.bcb.pix'),
            formatField('01', payloadKey),
            payloadDesc ? formatField('02', payloadDesc) : ''
        ].join('')),
        formatField('52', '0000'), // Merchant Category Code
        formatField('53', '986'),  // Transaction Currency (BRL)
        formatField('54', amount), // Transaction Amount
        formatField('58', 'BR'),   // Country Code
        formatField('59', payloadName), // Merchant Name
        formatField('60', payloadCity), // Merchant City
        formatField('62', formatField('05', '***')), // Additional Data Field Template (TxID)
        '6304' // CRC16 Placeholder
    ].join('');

    // Cálculo do CRC16 (CCITT-FALSE)
    const crc16 = (str) => {
        let crc = 0xFFFF;
        for (let i = 0; i < str.length; i++) {
            crc ^= str.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
                else crc = crc << 1;
            }
        }
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    };

    return payload + crc16(payload);
};

// --- Componente Principal ---

const PixGenerator = ({ user, initialData, onFinish }) => {
  const [pixData, setPixData] = useState({ key: '', value: '', name: '', city: '', desc: '' });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [pspStatus, setPspStatus] = useState('idle'); 
  const [activeTab, setActiveTab] = useState('pix'); 
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({ key: '', name: '', city: 'Sao Paulo', linkProvider: 'Mercado Pago', linkApiKey: '' });
  const [authStep, setAuthStep] = useState('form'); 
  const settingsInputRefs = useRef([]);

  useEffect(() => {
    if (!user) return;
    if (initialData?.paymentMethod === 'card_link') { setActiveTab('link'); }
    if (initialData) {
        setPixData(prev => ({ ...prev, value: initialData.value || '', desc: initialData.description || '' }));
    }
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'paymentConfig');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettingsData({
              key: data.key || '',
              name: data.name || '',
              city: data.city || '',
              linkProvider: data.linkProvider || 'Mercado Pago',
              linkApiKey: data.linkApiKey || ''
          });
          setPixData(prev => ({ ...prev, key: data.key || '', name: data.name || '', city: data.city || '', value: initialData?.value || prev.value || '', desc: initialData?.description || prev.desc || '' }));
        }
      } catch (error) { console.error(error); }
    };
    fetchSettings();
  }, [user, initialData]);

  const isValid = useMemo(() => pixData.key && pixData.value && pixData.name && pixData.city, [pixData]);

  const generatePix = (e) => {
    e.preventDefault();
    if (!isValid) return;

    setPspStatus('registering');
    
    setTimeout(() => {
      try {
        const payload = generatePixPayload(pixData.key, parseFloat(pixData.value), pixData.desc, pixData.name, pixData.city);
        setGeneratedCode(payload);
        setPspStatus('waiting');
      } catch (e) {
        console.error("Erro ao gerar payload", e);
        setPspStatus('idle');
      }
    }, 1500);
  };

  const generatePaymentLink = (e) => {
      e.preventDefault();
      setPspStatus('registering');
      setTimeout(() => {
          // Mock Link
          const mockLink = `https://pay.provider.com/${Math.random().toString(36).substring(7)}`;
          setGeneratedCode(mockLink);
          setPspStatus('link_ready');
      }, 1500);
  }

  const handleCopy = () => { 
      if (generatedCode) {
        navigator.clipboard.writeText(generatedCode); 
        alert('Copiado!'); 
      }
  }
  const handleShare = async () => {
    if (navigator.share && generatedCode) { await navigator.share({ title: 'Cobrança', text: `Pagar: ${generatedCode}` }); } else { handleCopy(); }
  };

  // Settings Handlers
  const handleInitiateSaveSettings = (e) => { e.preventDefault(); setAuthStep('2fa'); };
  const handleConfirmSettings2FA = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'paymentConfig'), settingsData);
        setPixData(prev => ({ ...prev, key: settingsData.key, name: settingsData.name, city: settingsData.city }));
        setShowSettings(false); setAuthStep('form'); alert("Salvo!");
    } catch (error) { alert("Erro ao salvar."); }
  };
  const handle2FAChange = (index, value) => { if (isNaN(value)) return; if (value.length === 1 && index < 5) { settingsInputRefs.current[index + 1]?.focus(); } };

  return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative animate-in fade-in zoom-in duration-300">
          
          {showSettings && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20}/> Configurações</h3>
                        <button onClick={() => {setShowSettings(false); setAuthStep('form')}} className="hover:bg-slate-800 p-1 rounded"><X size={20}/></button>
                    </div>
                    <div className="p-6">
                        {authStep === 'form' ? (
                            <form onSubmit={handleInitiateSaveSettings} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Chave Pix</label>
                                    <input required placeholder="CPF, Email ou Aleatória" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={settingsData.key || ''} onChange={e => setSettingsData({...settingsData, key: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Nome do Beneficiário</label>
                                    <input required placeholder="Seu Nome ou Empresa" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={settingsData.name || ''} onChange={e => setSettingsData({...settingsData, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Cidade</label>
                                    <input required placeholder="Sua Cidade" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={settingsData.city || ''} onChange={e => setSettingsData({...settingsData, city: e.target.value})} />
                                </div>
                                <div className="pt-2 bg-yellow-50 p-3 rounded text-xs text-yellow-800 flex gap-2 border border-yellow-100">
                                    <Lock size={14}/> 
                                    <span>Alterações sensíveis requerem confirmação de segurança (2FA).</span>
                                </div>
                                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition-colors">Salvar Configurações</button>
                            </form>
                        ) : (
                            <form onSubmit={handleConfirmSettings2FA} className="text-center">
                                <h4 className="text-lg font-bold text-slate-800 mb-2">Confirmação de Segurança</h4>
                                <p className="text-sm text-slate-500 mb-6">Digite o código de 6 dígitos enviado ao seu dispositivo.</p>
                                <div className="flex gap-2 justify-center mb-6">
                                    {[0,1,2,3,4,5].map(i => (
                                        <input 
                                            key={i} 
                                            ref={el => settingsInputRefs.current[i] = el} 
                                            type="text" 
                                            maxLength="1" 
                                            onChange={(e) => handle2FAChange(i, e.target.value)} 
                                            className="w-10 h-12 text-center text-xl font-bold border-2 border-slate-200 rounded focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" 
                                        />
                                    ))}
                                </div>
                                <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-sm transition-colors">Confirmar Alteração</button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col h-full">
            {/* Header e Abas */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => { setActiveTab('pix'); setGeneratedCode(null); setPspStatus('idle'); }} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'pix' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Pix</button>
                    <button onClick={() => { setActiveTab('link'); setGeneratedCode(null); setPspStatus('idle'); }} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'link' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Link Pagamento</button>
                </div>
                <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-all" title="Configurar Dados de Recebimento"><Settings size={20} /></button>
            </div>
            
            <form onSubmit={activeTab === 'pix' ? generatePix : generatePaymentLink} className="space-y-6 flex-grow">
                {activeTab === 'pix' ? (
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-sm text-purple-900 flex flex-col gap-1">
                            <div className="flex justify-between">
                                <span className="text-purple-400 font-medium">Recebedor</span>
                                <span className="font-bold">{pixData.name || '---'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-purple-400 font-medium">Chave</span>
                                <span className="font-mono">{pixData.key || '---'}</span>
                            </div>
                            {(!pixData.key || !pixData.name) && (
                                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                                    <Settings size={12}/> Configure seus dados no ícone acima para gerar.
                                </p>
                            )}
                        </div>
                ) : (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-900">
                            <p className="font-bold mb-1">Link de Pagamento</p>
                            <p className="text-blue-700 text-xs">Gateway: {settingsData.linkProvider}</p>
                        </div>
                )}
                
                <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Valor da Cobrança</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                            <input 
                                required 
                                type="number" 
                                step="0.01" 
                                placeholder="0,00"
                                className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-xl text-2xl font-bold text-slate-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all" 
                                value={pixData.value || ''} 
                                onChange={e => setPixData({...pixData, value: e.target.value})} 
                            />
                        </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Descrição (Opcional)</label>
                    <input 
                        type="text" 
                        maxLength={20}
                        placeholder="Ex: Serviço #123" 
                        className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        value={pixData.desc || ''}
                        onChange={e => setPixData({...pixData, desc: e.target.value})}
                    />
                </div>

                <div className="pt-4">
                    <button 
                        type="submit" 
                        disabled={pspStatus === 'registering' || (activeTab === 'pix' && !isValid)} 
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-200 transition-all text-white flex items-center justify-center gap-2
                            ${activeTab === 'pix' 
                                ? 'bg-purple-600 hover:bg-purple-700 active:scale-95' 
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'} 
                            disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed`}
                    >
                        {pspStatus === 'registering' ? (
                            <><Loader2 className="animate-spin"/> Processando...</>
                        ) : (
                            activeTab === 'pix' ? <><QrCode size={20}/> Gerar QR Code Pix</> : <><LinkIcon size={20}/> Criar Link</>
                        )}
                    </button>
                </div>
            </form>
          </div>

          <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center min-h-[400px]">
            {generatedCode ? (
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in duration-300">
                <div className={`${activeTab === 'pix' ? 'bg-purple-700' : 'bg-blue-700'} text-white p-4 text-center`}>
                    <p className="text-xs opacity-80 uppercase tracking-wide font-bold">Pagamento via {activeTab === 'pix' ? 'Pix' : 'Link'}</p>
                    <h3 className="font-bold text-lg truncate px-4">{activeTab === 'pix' ? pixData.name : settingsData.linkProvider}</h3>
                </div>
                <div className="p-8 flex flex-col items-center">
                    <div className="bg-white p-2 border-2 border-slate-100 rounded-xl mb-6 shadow-sm">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedCode)}`} 
                            alt="QR Code de Pagamento" 
                            className="w-48 h-48 object-contain"
                        />
                    </div>
                    <div className="mb-6">
                        <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">Valor a Pagar</p>
                        <p className="text-4xl font-extrabold text-slate-800">{formatCurrency(pixData.value)}</p>
                    </div>
                    <div className="flex gap-3 w-full">
                        <button onClick={handleCopy} className="flex-1 border-2 border-slate-200 py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold transition-all">
                            <Copy size={18}/> Copiar
                        </button>
                        <button onClick={handleShare} className="flex-1 bg-slate-800 text-white py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-slate-900 font-bold transition-all shadow-lg shadow-slate-200">
                            <Share2 size={18}/> Enviar
                        </button>
                    </div>
                </div>
                <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-400">Escaneie com o app do seu banco</p>
                </div>
            </div>
            ) : (
                <div className="text-slate-300 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <QrCode size={48} className="opacity-50"/>
                    </div>
                    <h3 className="text-slate-500 font-bold text-lg">Aguardando Geração</h3>
                    <p className="max-w-xs mx-auto text-sm mt-2">Preencha o valor e os dados ao lado para criar uma cobrança instantânea.</p>
                </div>
            )}
          </div>
      </div>
  );
};

export default PixGenerator;