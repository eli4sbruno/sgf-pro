import React, { useMemo } from 'react';
import { BarChart3, PieChart, AlertCircle } from 'lucide-react';

// Função utilitária definida localmente para evitar erros de importação
const formatCurrency = (value) => {
    const number = parseFloat(value);
    if (isNaN(number)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
};

// Adicionado valor padrão para transactions = []
const ReportsModule = ({ transactions = [] }) => {
    const summary = useMemo(() => {
        // Verificação de segurança: Se transactions não for um array válido, retorna valores zerados
        if (!transactions || !Array.isArray(transactions)) {
            return { income: 0, expense: 0, sortedCats: [] };
        }

        const catTotals = {};
        let income = 0;
        let expense = 0;
        
        transactions.forEach(t => {
            const val = parseFloat(t.value) || 0;
            if(t.status !== 'cancelled') {
                if(t.type === 'expense') {
                    expense += val;
                    const cat = t.category || 'Outros';
                    catTotals[cat] = (catTotals[cat] || 0) + val;
                } else {
                    income += val;
                }
            }
        });
        
        const sortedCats = Object.entries(catTotals)
            .sort(([,a], [,b]) => b - a)
            .map(([name, val]) => ({ name, val, percent: expense > 0 ? (val / expense) * 100 : 0 }));
            
        return { income, expense, sortedCats };
    }, [transactions]);

    const maxVal = Math.max(summary.income, summary.expense) || 1;

    // Se não houver transações (array vazio), exibe estado vazio amigável
    if (!transactions || transactions.length === 0) {
         return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-xl font-bold text-slate-800">Relatórios Gerenciais</h2>
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 flex flex-col items-center">
                    <BarChart3 className="mb-2 opacity-50" size={32} />
                    <p>Nenhuma transação registrada para gerar relatórios.</p>
                </div>
            </div>
         );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold text-slate-800">Relatórios Gerenciais</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-md font-semibold text-slate-700 mb-6 flex items-center gap-2"><BarChart3 size={18}/> Entradas vs Saídas</h3>
                    <div className="flex items-end justify-center space-x-12 h-48">
                        <div className="flex flex-col items-center gap-2 group w-24">
                             <span className="text-sm font-bold text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">{formatCurrency(summary.income)}</span>
                             <div className="w-full bg-green-500 rounded-t-lg transition-all duration-1000 ease-out hover:bg-green-400 relative" style={{ height: `${(summary.income / maxVal) * 100}%`, minHeight: '4px' }}></div>
                             <span className="text-sm font-medium text-slate-500">Receitas</span>
                        </div>
                         <div className="flex flex-col items-center gap-2 group w-24">
                             <span className="text-sm font-bold text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">{formatCurrency(summary.expense)}</span>
                             <div className="w-full bg-red-500 rounded-t-lg transition-all duration-1000 ease-out hover:bg-red-400 relative" style={{ height: `${(summary.expense / maxVal) * 100}%`, minHeight: '4px' }}></div>
                             <span className="text-sm font-medium text-slate-500">Despesas</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                     <h3 className="text-md font-semibold text-slate-700 mb-4 flex items-center gap-2"><PieChart size={18}/> Despesas por Categoria</h3>
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {summary.sortedCats.map((cat, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-700 font-medium">{cat.name}</span>
                                    <span className="text-slate-500">{formatCurrency(cat.val)} ({cat.percent.toFixed(1)}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${cat.percent}%` }}></div>
                                </div>
                            </div>
                        ))}
                        {summary.sortedCats.length === 0 && (
                            <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                                <AlertCircle size={16} />
                                <p>Sem dados de despesas para exibir.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ReportsModule;