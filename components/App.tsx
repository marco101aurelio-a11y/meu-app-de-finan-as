'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Types
interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
}

interface Budget {
  id: string;
  category: string;
  limit_amount: number;
  month: string;
}

interface CategorySpent {
  category: string;
  spent: number;
}

const CATEGORIES = [
  { id: 'Alimentação', icon: 'restaurant', color: 'orange' },
  { id: 'Transporte', icon: 'directions_car', color: 'blue' },
  { id: 'Lazer', icon: 'movie', color: 'purple' },
  { id: 'Saúde', icon: 'favorite', color: 'red' },
  { id: 'Educação', icon: 'school', color: 'indigo' },
  { id: 'Outros', icon: 'more_horiz', color: 'slate' },
];

export default function App() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'home' | 'history' | 'budgets' | 'add' | 'reports'>('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching transactions:', error);
      } else {
        setTransactions(data || []);
      }
    };

    const fetchBudgets = async () => {
      const currentMonth = format(new Date(), 'yyyy-MM');
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth);

      if (error) {
        console.error('Error fetching budgets:', error);
      } else {
        setBudgets(data || []);
      }
    };

    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTransactions(), fetchBudgets()]);
      setLoading(false);
    };

    loadData();

    // Set up realtime subscriptions
    const transactionsSubscription = supabase
      .channel('transactions_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'transactions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchTransactions();
      })
      .subscribe();

    const budgetsSubscription = supabase
      .channel('budgets_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'budgets',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchBudgets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(transactionsSubscription);
      supabase.removeChannel(budgetsSubscription);
    };
  }, [user]);

  const totalBalance = transactions.reduce((acc, curr) => {
    return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
  }, 0);

  const handleAddTransaction = async () => {
    if (!user || !amount) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          amount: parseFloat(amount.replace(',', '.')),
          type,
          category,
          description,
          date: new Date().toISOString()
        });

      if (error) throw error;
      
      // Reset form
      setAmount('');
      setDescription('');
      setView('home');
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const logOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error);
  };

  const renderHome = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 overflow-hidden rounded-full border-2 border-primary/20 relative">
            <Image 
              src={user?.user_metadata?.avatar_url || "https://picsum.photos/seed/user/100/100"} 
              alt="Profile" 
              fill
              className="object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <p className="text-xs text-slate-500">Olá, {user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário'}</p>
            <h2 className="text-lg font-bold leading-tight">Minhas Finanças</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex size-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-primary/10 transition-colors">
            <Search size={20} />
          </button>
          <button className="relative flex size-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-primary/10 transition-colors">
            <Bell size={20} />
            <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-[#101622]"></span>
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-primary rounded-2xl p-6 shadow-xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Wallet size={96} />
        </div>
        <div className="relative z-10">
          <p className="text-white/80 text-sm font-medium">Saldo Total Disponível</p>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-white text-3xl font-bold tracking-tight">
              R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <Eye size={20} className="text-white/60 cursor-pointer" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="bg-white/20 px-2 py-1 rounded text-xs font-semibold text-white flex items-center gap-1">
              <TrendingUp size={12} />
              +2.5%
            </div>
            <p className="text-white/60 text-xs italic">em relação ao mês passado</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Banknote, label: 'Pagar' },
          { icon: ArrowUp, label: 'Transferir' },
          { icon: Filter, label: 'Pix' },
          { icon: CreditCard, label: 'Depositar' }
        ].map((action, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <action.icon size={20} />
            </div>
            <span className="text-[10px] font-medium text-slate-500">{action.label}</span>
          </div>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-white">Transações Recentes</h4>
          <button onClick={() => setView('history')} className="text-primary text-xs font-bold">Ver tudo</button>
        </div>
        <div className="space-y-2">
          {transactions.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div className={`size-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-orange-900/30 text-orange-500'}`}>
                {t.type === 'income' ? <Banknote size={20} /> : <ShoppingBag size={20} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{t.description || t.category}</p>
                <p className="text-xs text-slate-500">{t.category}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'} R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && !loading && (
            <div className="text-center py-8 text-slate-500">Nenhuma transação encontrada.</div>
          )}
          {loading && (
            <div className="text-center py-8 text-slate-500 animate-pulse">Carregando transações...</div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderAdd = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full">
      <div className="flex items-center p-4 justify-between">
        <button onClick={() => setView('home')} className="size-12 flex items-center justify-center hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-bold flex-1 text-center pr-12">Nova Transação</h2>
      </div>

      <div className="flex flex-col items-center justify-center py-8 px-4">
        <p className="text-slate-400 text-sm font-medium mb-1">Valor da {type === 'expense' ? 'despesa' : 'receita'}</p>
        <h1 className="text-white text-[48px] font-bold">R$ {amount || '0,00'}</h1>
      </div>

      <div className="flex-1 px-4 space-y-6">
        <div className="flex gap-2 p-1 bg-slate-900 rounded-xl">
          <button 
            onClick={() => setType('expense')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === 'expense' ? 'bg-red-500 text-white' : 'text-slate-500'}`}
          >
            Despesa
          </button>
          <button 
            onClick={() => setType('income')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === 'income' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}
          >
            Receita
          </button>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
            <input 
              type="text" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/50 h-14 pl-12 pr-4 text-xl font-semibold outline-none focus:border-primary transition-all"
            />
          </div>

          <div>
            <h3 className="text-slate-300 text-sm font-semibold pb-3">Categoria</h3>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${category === cat.id ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-transparent text-slate-400'}`}
                >
                  <span className="text-xs font-bold">{cat.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <FileText className="absolute left-4 top-4 text-slate-400" size={20} />
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nota (opcional)"
              className="w-full min-h-[100px] rounded-xl border border-slate-800 bg-slate-900/50 p-4 pl-12 text-base outline-none focus:border-primary transition-all resize-none"
            ></textarea>
          </div>
        </div>

        <button 
          onClick={handleAddTransaction}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={20} />
          Salvar Transação
        </button>
      </div>
    </motion.div>
  );

  const getSpentByCategory = () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const monthlyTransactions = transactions.filter(t => 
      t.type === 'expense' && format(new Date(t.date), 'yyyy-MM') === currentMonth
    );

    const spentMap: { [key: string]: number } = {};
    monthlyTransactions.forEach(t => {
      spentMap[t.category] = (spentMap[t.category] || 0) + Number(t.amount);
    });

    return spentMap;
  };

  const spentByCategory = getSpentByCategory();

  const renderBudgets = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center p-4 justify-between sticky top-0 bg-[#101622] z-10">
        <button onClick={() => setView('home')} className="size-10 flex items-center justify-center hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Orçamentos</h2>
        <div className="size-10"></div>
      </div>

      <div className="px-4 space-y-4">
        {CATEGORIES.map((cat) => {
          const budget = budgets.find(b => b.category === cat.id);
          const spent = spentByCategory[cat.id] || 0;
          const limit = budget?.limit_amount || 0;
          const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          
          return (
            <div key={cat.id} className="bg-slate-900 rounded-2xl p-5 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{cat.id}</h4>
                    <p className="text-xs text-slate-500">
                      {limit > 0 ? `R$ ${spent.toLocaleString('pt-BR')} de R$ ${limit.toLocaleString('pt-BR')}` : 'Sem limite definido'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    // In a real app, we would use a modal. 
                    // For now, we'll just set a default or use a state-based input.
                    const amount = 1000; 
                    const currentMonth = format(new Date(), 'yyyy-MM');
                    const { error } = await supabase
                      .from('budgets')
                      .upsert({
                        user_id: user?.id,
                        category: cat.id,
                        limit_amount: amount,
                        month: currentMonth
                      }, { onConflict: 'user_id,category,month' });
                    
                    if (error) console.error('Error updating budget:', error);
                  }}
                  className="text-primary text-xs font-bold"
                >
                  {limit > 0 ? 'Editar' : 'Definir'}
                </button>
              </div>

              {limit > 0 && (
                <div className="space-y-1">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className={`h-full rounded-full ${percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-orange-500' : 'bg-primary'}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-medium">
                    <span className={percentage > 90 ? 'text-red-500' : 'text-slate-500'}>{percentage.toFixed(0)}% gasto</span>
                    <span className="text-slate-500">Restam R$ {Math.max(limit - spent, 0).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );

  const renderHistory = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center p-4 justify-between sticky top-0 bg-[#101622] z-10">
        <button onClick={() => setView('home')} className="size-10 flex items-center justify-center hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Histórico</h2>
        <div className="size-10"></div>
      </div>

      <div className="px-4 space-y-4">
        {transactions.map((t, i) => (
          <div key={t.id} className="flex items-center gap-4 p-3 bg-slate-900 rounded-xl border border-slate-800">
            <div className={`size-12 flex items-center justify-center rounded-xl ${t.type === 'income' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-orange-900/30 text-orange-500'}`}>
              {t.type === 'income' ? <Banknote size={24} /> : <ShoppingBag size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-white">{t.description || t.category}</p>
              <p className="text-xs text-slate-500">{t.category}</p>
            </div>
            <div className="text-right">
              <p className={`font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                {t.type === 'income' ? '+' : '-'} R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderReports = () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const monthlyTransactions = transactions.filter(t => format(new Date(t.date), 'yyyy-MM') === currentMonth);
    const totalIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const totalExpense = monthlyTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    
    // Group by category for chart
    const categoryData = CATEGORIES.map(cat => ({
      name: cat.id,
      value: spentByCategory[cat.id] || 0
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center p-4 justify-between sticky top-0 bg-[#101622] z-10">
          <button onClick={() => setView('home')} className="size-10 flex items-center justify-center hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-lg font-bold">Relatórios</h2>
          <div className="size-10"></div>
        </div>

        <div className="px-4 space-y-6">
          {/* Monthly Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-900/20 border border-emerald-900/30 rounded-2xl p-4">
              <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500 mb-2">
                <ArrowUp size={18} />
              </div>
              <p className="text-xs text-emerald-500/70 font-medium">Receitas</p>
              <h4 className="text-lg font-bold text-emerald-500">R$ {totalIncome.toLocaleString('pt-BR')}</h4>
            </div>
            <div className="bg-red-900/20 border border-red-900/30 rounded-2xl p-4">
              <div className="size-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 mb-2">
                <ArrowDown size={18} />
              </div>
              <p className="text-xs text-red-500/70 font-medium">Despesas</p>
              <h4 className="text-lg font-bold text-red-500">R$ {totalExpense.toLocaleString('pt-BR')}</h4>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 space-y-4">
            <h4 className="font-bold text-white flex items-center gap-2">
              <PieChart size={18} className="text-primary" />
              Gastos por Categoria
            </h4>
            
            <div className="space-y-4">
              {categoryData.map((item, i) => {
                const percentage = totalExpense > 0 ? (item.value / totalExpense) * 100 : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 font-medium">{item.name}</span>
                      <span className="text-white font-bold">R$ {item.value.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className="h-full bg-primary rounded-full"
                        transition={{ delay: i * 0.1 }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 text-right">{percentage.toFixed(1)}% do total</p>
                  </div>
                );
              })}
              {categoryData.length === 0 && (
                <p className="text-center py-4 text-slate-500 text-sm">Sem despesas este mês.</p>
              )}
            </div>
          </div>

          {/* Savings Rate */}
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-white">Taxa de Economia</h4>
              <span className="text-primary font-bold">
                {totalIncome > 0 ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <p className="text-xs text-slate-400">Você economizou R$ {Math.max(totalIncome - totalExpense, 0).toLocaleString('pt-BR')} este mês.</p>
          </div>
        </div>
      </motion.div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#101622] text-slate-100 font-sans pb-24">
      <div className="max-w-xl mx-auto p-4">
        {view === 'home' && renderHome()}
        {view === 'add' && renderAdd()}
        {view === 'history' && renderHistory()}
        {view === 'budgets' && renderBudgets()}
        {view === 'reports' && renderReports()}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#101622] border-t border-slate-800 px-6 py-3 z-20">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-primary' : 'text-slate-500'}`}>
            <Home size={24} />
            <span className="text-[10px] font-medium">Início</span>
          </button>
          <button onClick={() => setView('budgets')} className={`flex flex-col items-center gap-1 ${view === 'budgets' ? 'text-primary' : 'text-slate-500'}`}>
            <Wallet size={24} />
            <span className="text-[10px] font-medium">Metas</span>
          </button>
          
          <div className="relative -top-8">
            <button 
              onClick={() => setView('add')}
              className="size-14 bg-primary text-white rounded-full shadow-lg shadow-primary/40 flex items-center justify-center border-4 border-[#101622] active:scale-95 transition-transform"
            >
              <Plus size={32} />
            </button>
          </div>

          <button onClick={() => setView('reports')} className={`flex flex-col items-center gap-1 ${view === 'reports' ? 'text-primary' : 'text-slate-500'}`}>
            <BarChart3 size={24} />
            <span className="text-[10px] font-medium">Relatórios</span>
          </button>
          <button onClick={logOut} className="flex flex-col items-center gap-1 text-slate-500">
            <UserIcon size={24} />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
