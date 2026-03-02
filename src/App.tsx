import { useState, useEffect } from 'react';
import { Trash2, Plus, Zap, Heart, Calendar, BarChart3, Moon, Sun, LogOut } from 'lucide-react';
import { db, auth, googleProvider } from './firebase';
import { setDoc, getDoc, doc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

const DEFAULT_TASKS = [
  { id: 1, name: 'Рабочий день', points: 100, type: 'income', completed: true, date: new Date().toISOString().split('T')[0] },
  { id: 2, name: 'Готовка', points: 30, type: 'income', completed: false, date: new Date().toISOString().split('T')[0] },
  { id: 3, name: 'Стриминг фильма', points: 80, type: 'expense', completed: false, date: new Date().toISOString().split('T')[0] },
];

export default function LifeTracker() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(100);
  
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  
  const [taskName, setTaskName] = useState('');
  const [taskPoints, setTaskPoints] = useState('');
  const [taskType, setTaskType] = useState('income');
  const [activeTab, setActiveTab] = useState('tasks');
  const [theme, setTheme] = useState('dark');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savedTasks, setSavedTasks] = useState<any[]>([]);
  const [templateSchedule, setTemplateSchedule] = useState('once');

  // Слушаем статус авторизации
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Загружаем данные из Firebase когда юзер залогинен
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    const loadDataFromFirebase = async () => {
      try {
        setIsLoading(true);
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBalance(data.balance ?? 100);
          setTasks(data.tasks || DEFAULT_TASKS);
          setSavedTasks(data.savedTasks || []);
          setTheme(data.theme || 'dark');
        }
      } catch (error) {
        console.error('Ошибка загрузки:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDataFromFirebase();
  }, [user]);

  // Сохраняем в Firebase при изменении данных
  useEffect(() => {
    if (!user) return;
    const saveToFirebase = async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          balance,
          tasks,
          savedTasks,
          theme,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Ошибка сохранения в Firebase:', error);
      }
    };
    
    saveToFirebase();
  }, [balance, tasks, savedTasks, theme, user]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Ошибка входа:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setBalance(100);
      setTasks(DEFAULT_TASKS);
      setSavedTasks([]);
      setTheme('dark');
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  };

  const addTask = () => {
    if (taskName && taskPoints) {
      const newTask = {
        id: Date.now(),
        name: taskName,
        points: parseInt(taskPoints),
        type: taskType,
        completed: false,
        date: selectedDate,
      };
      setTasks([...tasks, newTask]);
      setTaskName('');
      setTaskPoints('');
      setTaskType('income');
    }
  };

  const saveTaskTemplate = () => {
    if (taskName && taskPoints) {
      const template = {
        id: Date.now(),
        name: taskName,
        points: parseInt(taskPoints),
        type: taskType,
        schedule: templateSchedule,
      };
      setSavedTasks([...savedTasks, template]);
      setTaskName('');
      setTaskPoints('');
      setTaskType('income');
      setTemplateSchedule('once');
    }
  };

  const addTaskFromTemplate = (template) => {
    const today = new Date();
    const daysToAdd = [];

    if (template.schedule === 'once') {
      daysToAdd.push(0);
    } else if (template.schedule === 'daily') {
      for (let i = 0; i < 7; i++) {
        daysToAdd.push(i);
      }
    } else if (template.schedule === 'workweek') {
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dayOfWeek = date.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          daysToAdd.push(i);
        }
      }
    }

    const newTasks = daysToAdd.map(offset => {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      const dateStr = date.toISOString().split('T')[0];
      
      return {
        id: Date.now() + offset,
        name: template.name,
        points: template.points,
        type: template.type,
        completed: false,
        date: dateStr,
      };
    });

    setTasks([...tasks, ...newTasks]);
  };

  const deleteTaskTemplate = (id) => {
    setSavedTasks(savedTasks.filter(t => t.id !== id));
  };

  const completeTask = (id) => {
    setTasks(tasks.map(task => {
      if (task.id === id && !task.completed) {
        const newBalance = task.type === 'income' 
          ? balance + task.points 
          : Math.max(0, balance - task.points);
        setBalance(newBalance);
        return { ...task, completed: true };
      }
      return task;
    }));
  };

  const deleteTask = (id) => {
    const taskToDelete = tasks.find(t => t.id === id);
    
    if (taskToDelete && taskToDelete.completed) {
      const newBalance = taskToDelete.type === 'income' 
        ? balance - taskToDelete.points
        : balance + taskToDelete.points;
      setBalance(newBalance);
    }
    
    setTasks(tasks.filter(task => task.id !== id));
  };

  const resetDay = () => {
    if (confirm('Сбросить прогресс за сегодня? Баланс останется.')) {
      setTasks(tasks.map(task => 
        task.date === new Date().toISOString().split('T')[0]
          ? { ...task, completed: false }
          : task
      ));
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const resetBalance = () => {
    if (confirm('Сбросить баланс на 100? Задачи и шаблоны останутся.')) {
      setBalance(100);
    }
  };

  const clearAllData = () => {
    if (confirm('Очистить ВСЕ данные? Баланс, задачи и шаблоны будут удалены!')) {
      setBalance(100);
      setTasks(DEFAULT_TASKS);
      setSavedTasks([]);
      setTheme('dark');
    }
  };
  const exportData = () => {
  const data = {
    balance,
    tasks,
    savedTasks,
    theme,
    exportDate: new Date().toISOString(),
  };
  
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `life-quest-backup-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const importData = (event: any) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e: any) => {
    try {
      const data = JSON.parse(e.target.result);
      setBalance(data.balance || 100);
      setTasks(data.tasks || []);
      setSavedTasks(data.savedTasks || []);
      setTheme(data.theme || 'dark');
      alert('✅ Данные успешно загружены!');
    } catch (error) {
      alert('❌ Ошибка при загрузке файла!');
    }
  };
  reader.readAsText(file);
};

  const selectedTasks = tasks.filter(t => t.date === selectedDate);
  const incomeTasks = selectedTasks.filter(t => t.type === 'income');
  const expenseTasks = selectedTasks.filter(t => t.type === 'expense');
  const completedIncome = incomeTasks.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0);
  const completedExpense = expenseTasks.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0);

const uniqueDates = [...new Set(tasks.map(t => t.date))] as string[];
uniqueDates.sort().reverse(); 
 const dailyStats = uniqueDates.map(date => {
  const dayTasks = tasks.filter(t => t.date === date);
  const income = dayTasks
    .filter(t => t.type === 'income' && t.completed)
    .reduce((sum: number, t: any) => sum + t.points, 0);
  const expense = dayTasks
    .filter(t => t.type === 'expense' && t.completed)
    .reduce((sum: number, t: any) => sum + t.points, 0);
  return { date, income, expense, net: income - expense };
});
  const totalLevel = Math.floor(balance / 100);
  const levelProgress = (balance % 100) / 100;

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const cardClass = isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/80 border-slate-200/80';
  const inputClass = isDark ? 'bg-slate-700/50 border-slate-600/50 text-white placeholder-slate-400' : 'bg-white/50 border-slate-300/50 text-slate-900 placeholder-slate-500';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">⏳ Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-8">
          <div>
            <h1 className="text-5xl font-black text-white tracking-tight">LIFE QUEST</h1>
            <p className="text-cyan-400 text-sm font-bold tracking-widest mt-2">v2.0</p>
          </div>
          <p className="text-slate-400 text-lg">Превратите свою жизнь в игру 🎮</p>
          <button
            onClick={handleGoogleLogin}
            className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto text-lg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Войти через Google
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">⏳ Загрузка данных...</div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${bgClass} ${textClass} font-sans overflow-hidden transition-colors duration-300`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-0 right-0 w-96 h-96 ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-400/5'} rounded-full blur-3xl`}></div>
        <div className={`absolute bottom-0 left-0 w-80 h-80 ${isDark ? 'bg-violet-500/10' : 'bg-violet-400/5'} rounded-full blur-3xl`}></div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex justify-between items-center mb-6 pt-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">LIFE QUEST</h1>
            <span className={`text-sm font-bold tracking-widest ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>v2.0</span>
          </div>
          <div className="flex gap-2 items-center">
            {user && (
              <span className={`text-xs font-semibold truncate max-w-[100px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {user.displayName?.split(' ')[0]}
              </span>
            )}
            <button
              onClick={handleLogout}
              className={`p-3 rounded-lg transition-all ${isDark ? 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-400' : 'bg-slate-200/50 hover:bg-slate-300/50 text-slate-600'}`}
              title="Выйти"
            >
              <LogOut size={18} />
            </button>
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-lg transition-all ${isDark ? 'bg-yellow-500/20 hover:bg-yellow-500/30' : 'bg-slate-800/20 hover:bg-slate-800/30'}`}
              title="Переключить тему"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={resetBalance}
              className={`p-3 rounded-lg transition-all font-bold ${isDark ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300' : 'bg-red-400/20 hover:bg-red-400/30 text-red-600'}`}
              title="Сбросить баланс на 100"
            >
              🔄
            </button>
            <button
              onClick={clearAllData}
              className={`p-3 rounded-lg transition-all font-bold ${isDark ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300' : 'bg-orange-400/20 hover:bg-orange-400/30 text-orange-600'}`}
              title="Очистить все данные"
            >
              🗑️
            </button>
            <button
  onClick={exportData}
  className={`p-3 rounded-lg transition-all font-bold ${isDark ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' : 'bg-blue-400/20 hover:bg-blue-400/30 text-blue-600'}`}
  title="Экспортировать данные в JSON"
>
  💾
</button>

<label className={`p-3 rounded-lg transition-all font-bold cursor-pointer ${isDark ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300' : 'bg-green-400/20 hover:bg-green-400/30 text-green-600'}`}
  title="Импортировать данные из JSON"
>
  📂
  <input
    type="file"
    accept=".json"
    onChange={importData}
    style={{ display: 'none' }}
  />
</label>
          </div>
        </div>
        
        <div className={`${isDark ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border-cyan-400/30' : 'bg-gradient-to-r from-cyan-400/20 to-violet-400/20 border-cyan-400/50'} border rounded-2xl p-8 backdrop-blur-sm mb-8`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className={`text-sm font-bold tracking-widest mb-2 ${isDark ? 'text-cyan-300/70' : 'text-cyan-600/70'}`}>ТЕКУЩИЙ БАЛАНС</p>
              <div className="text-6xl font-black tracking-tight">{balance}</div>
              <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>⭐ Уровень {totalLevel}</p>
            </div>
            <div className="text-4xl">💎</div>
          </div>
          
          <div className="space-y-2">
            <div className={`w-full rounded-full h-3 overflow-hidden border ${isDark ? 'bg-slate-700/50 border-cyan-400/20' : 'bg-slate-200/50 border-cyan-400/30'}`}>
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-500"
                style={{ width: `${levelProgress * 100}%` }}
              />
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {Math.round(levelProgress * 100)}% к следующему уровню
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className={`${isDark ? 'bg-green-500/10 border-green-400/30' : 'bg-green-400/10 border-green-400/50'} border rounded-lg p-4 backdrop-blur-sm`}>
            <p className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-green-300/70' : 'text-green-600/70'}`}>ДОХОД</p>
            <p className={`text-2xl font-black ${isDark ? 'text-green-400' : 'text-green-600'}`}>+{completedIncome}</p>
          </div>
          <div className={`${isDark ? 'bg-red-500/10 border-red-400/30' : 'bg-red-400/10 border-red-400/50'} border rounded-lg p-4 backdrop-blur-sm`}>
            <p className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-red-300/70' : 'text-red-600/70'}`}>РАСХОД</p>
            <p className={`text-2xl font-black ${isDark ? 'text-red-400' : 'text-red-600'}`}>−{completedExpense}</p>
          </div>
        </div>

        <div className={`flex gap-2 mb-6 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-300/50'} overflow-x-auto`}>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-3 font-bold text-sm tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'tasks'
                ? `${isDark ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-cyan-600 border-b-2 border-cyan-600'}`
                : `${isDark ? 'text-slate-400' : 'text-slate-600'}`
            }`}
          >
            ЗАДАЧИ
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-3 font-bold text-sm tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'add'
                ? `${isDark ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-cyan-600 border-b-2 border-cyan-600'}`
                : `${isDark ? 'text-slate-400' : 'text-slate-600'}`
            }`}
          >
            ДОБАВИТЬ
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-3 font-bold text-sm tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'templates'
                ? `${isDark ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-cyan-600 border-b-2 border-cyan-600'}`
                : `${isDark ? 'text-slate-400' : 'text-slate-600'}`
            }`}
          >
            ШАБЛОНЫ
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-3 font-bold text-sm tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'stats'
                ? `${isDark ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-cyan-600 border-b-2 border-cyan-600'}`
                : `${isDark ? 'text-slate-400' : 'text-slate-600'}`
            }`}
          >
            ИСТОРИЯ
          </button>
        </div>

        {activeTab === 'tasks' && (
          <div className="space-y-6 mb-8">
            <div className="flex items-center gap-3">
              <Calendar size={18} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`px-3 py-2 rounded-lg border transition-colors focus:outline-none ${inputClass}`}
              />
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${isDark ? 'bg-slate-700/50 hover:bg-slate-600/50' : 'bg-slate-200/50 hover:bg-slate-300/50'}`}
              >
                Сегодня
              </button>
            </div>

            {incomeTasks.length > 0 && (
              <div>
                <h3 className={`text-xs font-black tracking-widest mb-3 flex items-center gap-2 ${isDark ? 'text-green-400/70' : 'text-green-600/70'}`}>
                  <Zap size={14} /> ДОХОДНЫЕ ЗАДАЧИ
                </h3>
                <div className="space-y-2">
                  {incomeTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={() => completeTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>
            )}

            {expenseTasks.length > 0 && (
              <div>
                <h3 className={`text-xs font-black tracking-widest mb-3 flex items-center gap-2 ${isDark ? 'text-red-400/70' : 'text-red-600/70'}`}>
                  <Heart size={14} /> РАСХОДЫ
                </h3>
                <div className="space-y-2">
                  {expenseTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={() => completeTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedTasks.length === 0 && (
              <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <p className="text-sm">Нет задач на эту дату</p>
                <p className="text-xs mt-1">Добавь задачу в табе "ДОБАВИТЬ"</p>
              </div>
            )}

            {selectedDate === new Date().toISOString().split('T')[0] && selectedTasks.some(t => t.completed) && (
              <button
                onClick={resetDay}
                className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isDark ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300' : 'bg-orange-400/20 hover:bg-orange-400/30 text-orange-600'}`}
              >
                Сбросить прогресс за сегодня
              </button>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className={`${cardClass} border rounded-xl p-6 space-y-4`}>
            <input
              type="text"
              placeholder="Название задачи..."
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:border-cyan-400/50 transition-colors ${inputClass}`}
              onKeyPress={(e) => e.key === 'Enter' && addTask()}
            />
            
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                placeholder="Баллы..."
                value={taskPoints}
                onChange={(e) => setTaskPoints(e.target.value)}
                className={`col-span-2 rounded-lg px-4 py-3 border focus:outline-none focus:border-cyan-400/50 transition-colors ${inputClass}`}
              />
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className={`rounded-lg px-3 py-3 border focus:outline-none focus:border-cyan-400/50 transition-colors ${inputClass}`}
              >
                <option value="income">📈 Доход</option>
                <option value="expense">📉 Расход</option>
              </select>
            </div>

            <div>
              <label className={`text-sm font-semibold mb-2 block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Расписание шаблона:</label>
              <select
                value={templateSchedule}
                onChange={(e) => setTemplateSchedule(e.target.value)}
                className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:border-cyan-400/50 transition-colors ${inputClass}`}
              >
                <option value="once">Один раз (выбранная дата)</option>
                <option value="daily">Каждый день (неделя)</option>
                <option value="workweek">Рабочие дни (пн-пт)</option>
              </select>
            </div>

            <div>
              <label className={`text-sm font-semibold mb-2 block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Дата:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:border-cyan-400/50 transition-colors ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={addTask}
                className="bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Добавить
              </button>
              <button
                onClick={saveTaskTemplate}
                className={`font-bold py-3 px-4 rounded-lg transition-all ${isDark ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300' : 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-600'}`}
              >
                💾 Сохранить
              </button>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-4 mb-8">
            {savedTasks.length === 0 ? (
              <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <p className="text-sm">Нет сохранённых шаблонов</p>
                <p className="text-xs mt-1">Добавь задачу в табе "ДОБАВИТЬ" и нажми "💾 Сохранить"</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedTasks.map((template: any) => (
                  <div key={String(template.id)} className={`${cardClass} border rounded-lg p-4 backdrop-blur-sm`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {template.name}
                        </p>
                        <p className={`text-sm font-bold ${template.type === 'income' ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                          {template.type === 'income' ? '+' : '−'}{template.points} pts
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {template.schedule === 'once' && '📅 Один раз'}
                          {template.schedule === 'daily' && '📅 Каждый день (неделя)'}
                          {template.schedule === 'workweek' && '📅 Рабочие дни (пн-пт)'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => addTaskFromTemplate(template)}
                          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all transform hover:scale-105 active:scale-95 ${
                            template.type === 'income'
                              ? isDark ? 'bg-green-500/30 hover:bg-green-500/50 text-green-300' : 'bg-green-400/30 hover:bg-green-400/50 text-green-700'
                              : isDark ? 'bg-red-500/30 hover:bg-red-500/50 text-red-300' : 'bg-red-400/30 hover:bg-red-400/50 text-red-700'
                          }`}
                        >
                          ➕
                        </button>
                        <button
                          onClick={() => deleteTaskTemplate(template.id)}
                          className={`p-2 hover:bg-slate-600/50 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-600 hover:text-slate-700'}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={20} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
              <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>ИСТОРИЯ ПО ДАТАМ</h2>
            </div>

            {dailyStats.length === 0 ? (
              <p className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Нет данных</p>
            ) : (
              <div className="space-y-3">
                {dailyStats.map(stat => (
                  <div 
                    key={stat.date as string}
                    className={`${cardClass} border rounded-lg p-4 backdrop-blur-sm`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className={`font-bold tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {new Date(stat.date + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className={`text-lg font-black ${stat.net >= 0 ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                        {stat.net >= 0 ? '+' : '−'}{Math.abs(stat.net)}
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className={`text-sm ${isDark ? 'text-green-400/70' : 'text-green-600/70'}`}>
                        Доход: <span className="font-bold">{stat.income}</span>
                      </div>
                      <div className={`text-sm ${isDark ? 'text-red-400/70' : 'text-red-600/70'}`}>
                        Расход: <span className="font-bold">{stat.expense}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`mt-12 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
          <p>Превратите свою жизнь в игру 🎮</p>
          <p className="mt-2">Все данные сохраняются локально в браузере</p>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onComplete, onDelete, isDark }) {
  const isIncome = task.type === 'income';
  const statusColor = isIncome 
    ? task.completed 
      ? isDark ? 'bg-green-500/20 border-green-400/50' : 'bg-green-400/20 border-green-400/50'
      : isDark ? 'bg-slate-700/50 border-slate-600/50' : 'bg-slate-200/50 border-slate-300/50'
    : task.completed 
      ? isDark ? 'bg-red-500/20 border-red-400/50' : 'bg-red-400/20 border-red-400/50'
      : isDark ? 'bg-slate-700/50 border-slate-600/50' : 'bg-slate-200/50 border-slate-300/50';
  
  return (
    <div className={`border rounded-lg p-4 backdrop-blur-sm transition-all ${statusColor} ${task.completed ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className={task.completed ? `line-through ${isDark ? 'text-slate-400' : 'text-slate-600'}` : `${isDark ? 'text-white' : 'text-slate-900'} font-semibold`}>
            {task.name}
          </p>
          {!task.completed && (
            <p className={`text-sm font-bold ${isIncome ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
              {isIncome ? '+' : '−'}{task.points} pts
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!task.completed && (
            <button
              onClick={onComplete}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all transform hover:scale-105 active:scale-95 ${
                isIncome
                  ? isDark ? 'bg-green-500/30 hover:bg-green-500/50 text-green-300' : 'bg-green-400/30 hover:bg-green-400/50 text-green-700'
                  : isDark ? 'bg-red-500/30 hover:bg-red-500/50 text-red-300' : 'bg-red-400/30 hover:bg-red-400/50 text-red-700'
              }`}
            >
              ✓
            </button>
          )}
          <button
            onClick={onDelete}
            className={`p-2 hover:bg-slate-600/50 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-600 hover:text-slate-700'}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}