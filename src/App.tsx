import { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Zap, Heart, Calendar, BarChart3, Moon, Sun, LogOut, Trophy } from 'lucide-react';
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
  const loggingOut = useRef(false);
  const dataLoaded = useRef(false);
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
  const [goals, setGoals] = useState<any[]>([]);
  const [lastStreakBonus, setLastStreakBonus] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Record<string, string>>({});
  const [goalName, setGoalName] = useState('');
  const [goalCost, setGoalCost] = useState('');
  const [goalIcon, setGoalIcon] = useState('🎮');
  const [templateSchedule, setTemplateSchedule] = useState('once');
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month'>('week');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifTime, setNotifTime] = useState('20:00');
  const notifTimer = useRef<any>(null);

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
          setGoals(data.goals || []);
          setLastStreakBonus(data.lastStreakBonus || 0);
          setUnlockedAchievements(data.unlockedAchievements || {});
          setNotifEnabled(data.notifEnabled || false);
          setNotifTime(data.notifTime || '20:00');
          setTheme(data.theme || 'dark');
        }
      } catch (error) {
        console.error('Ошибка загрузки:', error);
      } finally {
        dataLoaded.current = true;
        setIsLoading(false);
      }
    };
    
    loadDataFromFirebase();
  }, [user]);

  // Сохраняем в Firebase при изменении данных (с debounce)
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Пропускаем первый рендер и пока данные не загружены
    if (!user || loggingOut.current || !dataLoaded.current) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          balance,
          tasks,
          savedTasks,
          goals,
          lastStreakBonus,
          unlockedAchievements,
          notifEnabled,
          notifTime,
          theme,
          lastUpdated: new Date().toISOString(),
        });
        console.log('Сохранено в Firebase');
      } catch (error) {
        console.error('Ошибка сохранения в Firebase:', error);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [balance, tasks, savedTasks, goals, lastStreakBonus, unlockedAchievements, notifEnabled, notifTime, theme, user]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Ошибка входа:', error);
    }
  };

  const handleLogout = async () => {
    try {
      loggingOut.current = true;
      dataLoaded.current = false;
      isFirstRender.current = true;
      await signOut(auth);
      setBalance(100);
      setTasks(DEFAULT_TASKS);
      setSavedTasks([]);
      setGoals([]);
      setLastStreakBonus(0);
      setUnlockedAchievements({});
      setNotifEnabled(false);
      setNotifTime('20:00');
      setTheme('dark');
    } catch (error) {
      loggingOut.current = false;
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
    if (confirm('Очистить ВСЕ данные? Баланс, задачи, шаблоны и цели будут удалены!')) {
      setBalance(100);
      setTasks(DEFAULT_TASKS);
      setSavedTasks([]);
      setGoals([]);
      setLastStreakBonus(0);
      setUnlockedAchievements({});
      setNotifEnabled(false);
      setNotifTime('20:00');
      setTheme('dark');
    }
  };
  const exportData = () => {
  const data = {
    balance,
    tasks,
    savedTasks,
    goals,
    lastStreakBonus,
    unlockedAchievements,
    notifEnabled,
    notifTime,
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
      setGoals(data.goals || []);
      setLastStreakBonus(data.lastStreakBonus || 0);
      setUnlockedAchievements(data.unlockedAchievements || {});
      setNotifEnabled(data.notifEnabled || false);
      setNotifTime(data.notifTime || '20:00');
      setTheme(data.theme || 'dark');
      alert('✅ Данные успешно загружены!');
    } catch (error) {
      alert('❌ Ошибка при загрузке файла!');
    }
  };
  reader.readAsText(file);
};

  const GOAL_ICONS = ['🎮', '🎬', '🍕', '✈️', '👟', '📱', '🎧', '💻', '🏋️', '📚', '🎸', '🏖️', '🚗', '🎁', '💎', '🏠'];
  const MAX_ACTIVE_GOALS = 5;
  const activeGoals = goals.filter(g => !g.purchased);
  const purchasedGoals = goals.filter(g => g.purchased);

  const addGoal = () => {
    if (!goalName || !goalCost) return;
    if (activeGoals.length >= MAX_ACTIVE_GOALS) {
      alert(`Максимум ${MAX_ACTIVE_GOALS} активных целей!`);
      return;
    }
    const newGoal = {
      id: Date.now(),
      name: goalName,
      cost: parseInt(goalCost),
      icon: goalIcon,
      purchased: false,
      createdAt: new Date().toISOString(),
    };
    setGoals([...goals, newGoal]);
    setGoalName('');
    setGoalCost('');
    setGoalIcon('🎮');
  };

  const purchaseGoal = (id: number) => {
    const goal = goals.find(g => g.id === id);
    if (!goal || goal.purchased) return;
    if (balance < goal.cost) {
      alert(`Не хватает баллов! Нужно ${goal.cost}, у тебя ${balance}`);
      return;
    }
    if (confirm(`Купить "${goal.name}" за ${goal.cost} баллов?`)) {
      setBalance(balance - goal.cost);
      setGoals(goals.map(g => g.id === id ? { ...g, purchased: true, purchasedAt: new Date().toISOString() } : g));
    }
  };

  const deleteGoal = (id: number) => {
    setGoals(goals.filter(g => g.id !== id));
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

  // Streak calculation
  const calculateStreak = () => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTasks = tasks.filter((t: any) => t.date === dateStr);
      const hasCompleted = dayTasks.some((t: any) => t.type === 'income' && t.completed);
      if (hasCompleted) {
        streak++;
      } else if (i === 0) {
        // Сегодня ещё ничего не сделал — не ломаем серию, проверяем вчера
        continue;
      } else {
        break;
      }
    }
    return streak;
  };
  const currentStreak = calculateStreak();
  const streakBonus = Math.floor(currentStreak / 7) * 50;
  const daysToNextBonus = currentStreak % 7 === 0 && currentStreak > 0 ? 7 : 7 - (currentStreak % 7);

  // Auto-apply streak bonus
  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    if (streakBonus > lastStreakBonus) {
      const diff = streakBonus - lastStreakBonus;
      setBalance(prev => prev + diff);
      setLastStreakBonus(streakBonus);
    }
  }, [streakBonus, lastStreakBonus, user]);

  // Achievements system
  const ACHIEVEMENTS = [
    { id: 'first_task', icon: '⭐', name: 'Первый шаг', desc: 'Выполни первую задачу', check: () => tasks.some((t: any) => t.completed) },
    { id: 'ten_tasks', icon: '🔟', name: 'Десятка', desc: 'Выполни 10 задач', check: () => tasks.filter((t: any) => t.completed).length >= 10 },
    { id: 'fifty_tasks', icon: '💪', name: 'Полтинник', desc: 'Выполни 50 задач', check: () => tasks.filter((t: any) => t.completed).length >= 50 },
    { id: 'hundred_tasks', icon: '💯', name: 'Сотня', desc: 'Выполни 100 задач', check: () => tasks.filter((t: any) => t.completed).length >= 100 },
    { id: 'balance_500', icon: '💰', name: 'Копилка', desc: 'Накопи 500 баллов', check: () => balance >= 500 },
    { id: 'balance_1000', icon: '🏦', name: 'Тысячник', desc: 'Накопи 1000 баллов', check: () => balance >= 1000 },
    { id: 'balance_5000', icon: '👑', name: 'Магнат', desc: 'Накопи 5000 баллов', check: () => balance >= 5000 },
    { id: 'streak_3', icon: '🔥', name: 'Разогрев', desc: 'Серия 3 дня подряд', check: () => currentStreak >= 3 },
    { id: 'streak_7', icon: '🔥', name: 'Неделя огня', desc: 'Серия 7 дней подряд', check: () => currentStreak >= 7 },
    { id: 'streak_14', icon: '🔥', name: 'Двухнедельный марафон', desc: 'Серия 14 дней подряд', check: () => currentStreak >= 14 },
    { id: 'streak_30', icon: '🌋', name: 'Вулкан', desc: 'Серия 30 дней подряд', check: () => currentStreak >= 30 },
    { id: 'first_goal', icon: '🏆', name: 'Мечтатель', desc: 'Создай первую цель', check: () => goals.length > 0 },
    { id: 'goal_bought', icon: '🎉', name: 'Достигатор', desc: 'Купи первую цель', check: () => goals.some((g: any) => g.purchased) },
    { id: 'three_goals_bought', icon: '🏅', name: 'Коллекционер', desc: 'Купи 3 цели', check: () => goals.filter((g: any) => g.purchased).length >= 3 },
    { id: 'level_5', icon: '🎮', name: 'Уровень 5', desc: 'Достигни 5 уровня', check: () => Math.floor(balance / 100) >= 5 },
    { id: 'level_10', icon: '🚀', name: 'Уровень 10', desc: 'Достигни 10 уровня', check: () => Math.floor(balance / 100) >= 10 },
    { id: 'template_master', icon: '📋', name: 'Шаблонщик', desc: 'Создай 5 шаблонов', check: () => savedTasks.length >= 5 },
    { id: 'big_day', icon: '📈', name: 'Ударный день', desc: 'Заработай 300+ за день', check: () => {
      const today = new Date().toISOString().split('T')[0];
      return tasks.filter((t: any) => t.date === today && t.type === 'income' && t.completed).reduce((s: number, t: any) => s + t.points, 0) >= 300;
    }},
  ];

  // Auto-unlock achievements
  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    let updated = false;
    const newUnlocked = { ...unlockedAchievements };
    for (const ach of ACHIEVEMENTS) {
      if (!newUnlocked[ach.id] && ach.check()) {
        newUnlocked[ach.id] = new Date().toISOString();
        updated = true;
      }
    }
    if (updated) {
      setUnlockedAchievements(newUnlocked);
    }
  }, [balance, tasks, goals, savedTasks, currentStreak, user]);

  const unlockedCount = Object.keys(unlockedAchievements).length;

  // Notification scheduling
  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Браузер не поддерживает уведомления');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotifEnabled(true);
      new Notification('🎮 Life Quest', { body: 'Уведомления включены! Напомним о задачах.' });
    } else {
      alert('Уведомления заблокированы. Разреши их в настройках браузера.');
    }
  };

  const disableNotifications = () => {
    setNotifEnabled(false);
    if (notifTimer.current) clearInterval(notifTimer.current);
  };

  useEffect(() => {
    if (!notifEnabled) {
      if (notifTimer.current) clearInterval(notifTimer.current);
      return;
    }

    const checkAndNotify = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (currentTime === notifTime) {
        const today = now.toISOString().split('T')[0];
        const todayTasks = tasks.filter((t: any) => t.date === today);
        const pending = todayTasks.filter((t: any) => !t.completed);
        if (pending.length > 0) {
          new Notification('🎮 Life Quest — Напоминание', {
            body: `У тебя ${pending.length} невыполненных ${pending.length === 1 ? 'задача' : pending.length < 5 ? 'задачи' : 'задач'} на сегодня!`,
            icon: '🔔',
          });
        }
      }
    };

    notifTimer.current = setInterval(checkAndNotify, 60000);
    return () => { if (notifTimer.current) clearInterval(notifTimer.current); };
  }, [notifEnabled, notifTime, tasks]);

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

        {/* Streak widget */}
        {currentStreak > 0 && (
          <div className={`${isDark ? 'bg-gradient-to-r from-orange-500/15 to-amber-500/15 border-orange-400/30' : 'bg-gradient-to-r from-orange-400/15 to-amber-400/15 border-orange-400/40'} border rounded-xl p-4 mb-4 backdrop-blur-sm`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔥</span>
                <div>
                  <p className={`font-black text-2xl ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                    {currentStreak} {currentStreak === 1 ? 'день' : currentStreak < 5 ? 'дня' : 'дней'}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-orange-300/60' : 'text-orange-600/60'}`}>
                    серия подряд
                  </p>
                </div>
              </div>
              <div className="text-right">
                {streakBonus > 0 && (
                  <p className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    +{streakBonus} бонус
                  </p>
                )}
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  {daysToNextBonus === 7 ? 'Бонус +50 через 7 дней' : `+50 через ${daysToNextBonus} дн.`}
                </p>
              </div>
            </div>
            {/* Mini streak dots */}
            <div className="flex gap-1 mt-3">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                const dateStr = d.toISOString().split('T')[0];
                const dayTasks = tasks.filter((t: any) => t.date === dateStr);
                const hasCompleted = dayTasks.some((t: any) => t.type === 'income' && t.completed);
                const isToday = i === 6;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-2 rounded-full transition-all ${
                      hasCompleted
                        ? 'bg-gradient-to-r from-orange-400 to-amber-400'
                        : isToday
                          ? isDark ? 'bg-slate-600 border border-dashed border-orange-400/50' : 'bg-slate-300 border border-dashed border-orange-400/50'
                          : isDark ? 'bg-slate-700/50' : 'bg-slate-200/50'
                    }`} />
                    <span className={`${isDark ? 'text-slate-500' : 'text-slate-500'}`} style={{ fontSize: '8px' }}>
                      {d.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notification widget */}
        <div className={`${cardClass} border rounded-xl p-4 mb-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{notifEnabled ? '🔔' : '🔕'}</span>
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Напоминания</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {notifEnabled ? `Каждый день в ${notifTime}` : 'Выключены'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifEnabled && (
              <input
                type="time"
                value={notifTime}
                onChange={(e) => setNotifTime(e.target.value)}
                className={`rounded-lg px-2 py-1.5 text-sm border focus:outline-none transition-colors ${inputClass}`}
                style={{ width: '90px' }}
              />
            )}
            <button
              onClick={notifEnabled ? disableNotifications : enableNotifications}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                notifEnabled
                  ? isDark ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50' : 'bg-slate-200/50 text-slate-600 hover:bg-slate-300/50'
                  : isDark ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30' : 'bg-cyan-400/20 text-cyan-700 hover:bg-cyan-400/30'
              }`}
            >
              {notifEnabled ? 'Выкл' : 'Вкл'}
            </button>
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
          <button
            onClick={() => setActiveTab('goals')}
            className={`px-4 py-3 font-bold text-sm tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'goals'
                ? `${isDark ? 'text-amber-400 border-b-2 border-amber-400' : 'text-amber-600 border-b-2 border-amber-600'}`
                : `${isDark ? 'text-slate-400' : 'text-slate-600'}`
            }`}
          >
            🏆 ЦЕЛИ
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`px-4 py-3 font-bold text-sm tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'achievements'
                ? `${isDark ? 'text-violet-400 border-b-2 border-violet-400' : 'text-violet-600 border-b-2 border-violet-600'}`
                : `${isDark ? 'text-slate-400' : 'text-slate-600'}`
            }`}
          >
            🏅 {unlockedCount}/{ACHIEVEMENTS.length}
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
          <div className="space-y-6 mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
                <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>СТАТИСТИКА</h2>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setStatsPeriod('week')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statsPeriod === 'week'
                      ? isDark ? 'bg-cyan-500/30 text-cyan-300' : 'bg-cyan-400/30 text-cyan-700'
                      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Неделя
                </button>
                <button
                  onClick={() => setStatsPeriod('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statsPeriod === 'month'
                      ? isDark ? 'bg-cyan-500/30 text-cyan-300' : 'bg-cyan-400/30 text-cyan-700'
                      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Месяц
                </button>
              </div>
            </div>

            {(() => {
              const days = statsPeriod === 'week' ? 7 : 30;
              const chartData = Array.from({ length: days }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (days - 1 - i));
                const dateStr = d.toISOString().split('T')[0];
                const dayTasks = tasks.filter((t: any) => t.date === dateStr);
                const income = dayTasks.filter((t: any) => t.type === 'income' && t.completed).reduce((s: number, t: any) => s + t.points, 0);
                const expense = dayTasks.filter((t: any) => t.type === 'expense' && t.completed).reduce((s: number, t: any) => s + t.points, 0);
                return { date: dateStr, income, expense, net: income - expense, label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) };
              });

              const maxBar = Math.max(...chartData.map(d => Math.max(d.income, d.expense)), 1);
              
              // Running balance chart
              let runningBalance = balance;
              for (let i = chartData.length - 1; i >= 0; i--) {
                runningBalance -= chartData[i].net;
              }
              const balanceData = chartData.map(d => {
                runningBalance += d.net;
                return { ...d, balance: runningBalance };
              });
              const minBal = Math.min(...balanceData.map(d => d.balance));
              const maxBal = Math.max(...balanceData.map(d => d.balance), 1);
              const balRange = maxBal - minBal || 1;

              const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
              const totalExpense = chartData.reduce((s, d) => s + d.expense, 0);

              return (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`${cardClass} border rounded-lg p-3 text-center`}>
                      <p className={`text-xs font-bold ${isDark ? 'text-green-400/70' : 'text-green-600/70'}`}>ДОХОД</p>
                      <p className={`text-xl font-black ${isDark ? 'text-green-400' : 'text-green-600'}`}>+{totalIncome}</p>
                    </div>
                    <div className={`${cardClass} border rounded-lg p-3 text-center`}>
                      <p className={`text-xs font-bold ${isDark ? 'text-red-400/70' : 'text-red-600/70'}`}>РАСХОД</p>
                      <p className={`text-xl font-black ${isDark ? 'text-red-400' : 'text-red-600'}`}>−{totalExpense}</p>
                    </div>
                    <div className={`${cardClass} border rounded-lg p-3 text-center`}>
                      <p className={`text-xs font-bold ${isDark ? 'text-cyan-400/70' : 'text-cyan-600/70'}`}>ИТОГО</p>
                      <p className={`text-xl font-black ${totalIncome - totalExpense >= 0 ? (isDark ? 'text-cyan-400' : 'text-cyan-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                        {totalIncome - totalExpense >= 0 ? '+' : '−'}{Math.abs(totalIncome - totalExpense)}
                      </p>
                    </div>
                  </div>

                  {/* Balance line chart */}
                  <div className={`${cardClass} border rounded-xl p-4`}>
                    <p className={`text-xs font-bold tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>📈 БАЛАНС</p>
                    <div className="relative h-32">
                      <svg viewBox={`0 0 ${balanceData.length * 20} 100`} className="w-full h-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isDark ? '#22d3ee' : '#0891b2'} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={isDark ? '#22d3ee' : '#0891b2'} stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <path
                          d={`M0,${100 - ((balanceData[0]?.balance - minBal) / balRange) * 85 - 5} ${balanceData.map((d, i) => `L${i * 20 + 10},${100 - ((d.balance - minBal) / balRange) * 85 - 5}`).join(' ')} L${(balanceData.length - 1) * 20 + 10},100 L0,100 Z`}
                          fill="url(#balGrad)"
                        />
                        <polyline
                          points={balanceData.map((d, i) => `${i * 20 + 10},${100 - ((d.balance - minBal) / balRange) * 85 - 5}`).join(' ')}
                          fill="none"
                          stroke={isDark ? '#22d3ee' : '#0891b2'}
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        {balanceData.map((d, i) => (
                          <circle
                            key={i}
                            cx={i * 20 + 10}
                            cy={100 - ((d.balance - minBal) / balRange) * 85 - 5}
                            r={statsPeriod === 'week' ? 3 : 1.5}
                            fill={isDark ? '#22d3ee' : '#0891b2'}
                          />
                        ))}
                      </svg>
                      <div className="absolute top-0 right-0">
                        <span className={`text-xs font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{maxBal}</span>
                      </div>
                      <div className="absolute bottom-0 right-0">
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{minBal}</span>
                      </div>
                    </div>
                    {statsPeriod === 'week' && (
                      <div className="flex justify-between mt-1">
                        {balanceData.map((d, i) => (
                          <span key={i} className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`} style={{ fontSize: '9px' }}>
                            {new Date(d.date + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short' })}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Income/Expense bar chart */}
                  <div className={`${cardClass} border rounded-xl p-4`}>
                    <p className={`text-xs font-bold tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>📊 ДОХОД / РАСХОД</p>
                    <div className="flex items-end gap-1 h-28">
                      {chartData.map((d, i) => {
                        const incH = (d.income / maxBar) * 100;
                        const expH = (d.expense / maxBar) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                            <div className="flex gap-px items-end flex-1 w-full justify-center">
                              <div
                                className={`rounded-t ${isDark ? 'bg-green-400' : 'bg-green-500'} transition-all duration-300`}
                                style={{ height: `${incH}%`, width: statsPeriod === 'week' ? '40%' : '45%', minHeight: d.income > 0 ? 2 : 0 }}
                              />
                              <div
                                className={`rounded-t ${isDark ? 'bg-red-400' : 'bg-red-500'} transition-all duration-300`}
                                style={{ height: `${expH}%`, width: statsPeriod === 'week' ? '40%' : '45%', minHeight: d.expense > 0 ? 2 : 0 }}
                              />
                            </div>
                            {statsPeriod === 'week' && (
                              <span className={`text-center ${isDark ? 'text-slate-500' : 'text-slate-500'}`} style={{ fontSize: '9px' }}>
                                {new Date(d.date + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short' })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-3 justify-center">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-sm ${isDark ? 'bg-green-400' : 'bg-green-500'}`} />
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Доход</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-sm ${isDark ? 'bg-red-400' : 'bg-red-500'}`} />
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Расход</span>
                      </div>
                    </div>
                  </div>

                  {/* Daily list */}
                  <div>
                    <p className={`text-xs font-bold tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>📋 ПО ДНЯМ</p>
                    {dailyStats.length === 0 ? (
                      <p className={`text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Нет данных</p>
                    ) : (
                      <div className="space-y-2">
                        {dailyStats.map(stat => (
                          <div 
                            key={stat.date as string}
                            className={`${cardClass} border rounded-lg p-3 backdrop-blur-sm flex justify-between items-center`}
                          >
                            <div className={`font-semibold text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {new Date(stat.date + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="flex gap-3 items-center">
                              <span className={`text-xs ${isDark ? 'text-green-400/70' : 'text-green-600/70'}`}>+{stat.income}</span>
                              <span className={`text-xs ${isDark ? 'text-red-400/70' : 'text-red-600/70'}`}>−{stat.expense}</span>
                              <span className={`text-sm font-black ${stat.net >= 0 ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                {stat.net >= 0 ? '+' : '−'}{Math.abs(stat.net)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-6 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={20} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
              <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                ЦЕЛИ ({activeGoals.length}/{MAX_ACTIVE_GOALS})
              </h2>
            </div>

            {activeGoals.length > 0 && (
              <div className="space-y-3">
                {activeGoals.map(goal => {
                  const progress = Math.min(balance / goal.cost, 1);
                  const canBuy = balance >= goal.cost;
                  return (
                    <div key={goal.id} className={`${cardClass} border rounded-xl p-5 backdrop-blur-sm transition-all ${canBuy ? (isDark ? 'ring-1 ring-amber-400/50' : 'ring-1 ring-amber-500/50') : ''}`}>
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{goal.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className={`font-bold text-lg truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{goal.name}</p>
                            <button
                              onClick={() => deleteGoal(goal.id)}
                              className={`p-1.5 rounded-lg transition-colors shrink-0 ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mt-2 mb-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                {balance} / {goal.cost} pts
                              </span>
                              <span className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                {Math.round(progress * 100)}%
                              </span>
                            </div>
                            <div className={`w-full rounded-full h-2.5 overflow-hidden ${isDark ? 'bg-slate-700/50' : 'bg-slate-200/50'}`}>
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${canBuy ? 'bg-gradient-to-r from-amber-400 to-yellow-300' : 'bg-gradient-to-r from-amber-500/60 to-amber-400/60'}`}
                                style={{ width: `${progress * 100}%` }}
                              />
                            </div>
                            {!canBuy && (
                              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                Ещё {goal.cost - balance} pts до цели
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => purchaseGoal(goal.id)}
                            disabled={!canBuy}
                            className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all ${
                              canBuy
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-900 transform hover:scale-105 active:scale-95'
                                : isDark ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed' : 'bg-slate-200/50 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {canBuy ? `🎉 Купить за ${goal.cost} pts` : `🔒 Не хватает баллов`}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeGoals.length < MAX_ACTIVE_GOALS && (
              <div className={`${cardClass} border rounded-xl p-5 space-y-4`}>
                <p className={`text-sm font-bold tracking-wider ${isDark ? 'text-amber-400/70' : 'text-amber-600/70'}`}>НОВАЯ ЦЕЛЬ</p>
                <input
                  type="text"
                  placeholder="На что копишь..."
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:border-amber-400/50 transition-colors ${inputClass}`}
                />
                <input
                  type="number"
                  placeholder="Стоимость в баллах..."
                  value={goalCost}
                  onChange={(e) => setGoalCost(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:border-amber-400/50 transition-colors ${inputClass}`}
                />
                <div>
                  <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Иконка:</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {GOAL_ICONS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => setGoalIcon(icon)}
                        className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                          goalIcon === icon
                            ? 'bg-amber-500/30 ring-2 ring-amber-400 scale-110'
                            : isDark ? 'bg-slate-700/50 hover:bg-slate-600/50' : 'bg-slate-200/50 hover:bg-slate-300/50'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>или своё:</span>
                    <input
                      type="text"
                      value={goalIcon}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 2) setGoalIcon(val);
                      }}
                      className={`w-14 h-10 text-center text-xl rounded-lg border focus:outline-none focus:border-amber-400/50 transition-colors ${inputClass}`}
                    />
                    <span className="text-2xl">{goalIcon}</span>
                  </div>
                </div>
                <button
                  onClick={addGoal}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-900 font-bold py-3 rounded-lg transition-all transform hover:scale-105 active:scale-95"
                >
                  + Добавить цель
                </button>
              </div>
            )}

            {activeGoals.length >= MAX_ACTIVE_GOALS && (
              <p className={`text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Достигнут лимит — {MAX_ACTIVE_GOALS} активных целей. Купи или удали цель, чтобы добавить новую.
              </p>
            )}

            {purchasedGoals.length > 0 && (
              <div className="mt-8">
                <p className={`text-xs font-bold tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>🏅 ДОСТИГНУТЫЕ</p>
                <div className="space-y-2">
                  {purchasedGoals.map(goal => (
                    <div key={goal.id} className={`${isDark ? 'bg-slate-800/30 border-slate-700/30' : 'bg-slate-100/50 border-slate-200/50'} border rounded-lg p-3 opacity-60 flex items-center gap-3`}>
                      <span className="text-2xl">{goal.icon}</span>
                      <div className="flex-1">
                        <p className={`font-semibold line-through ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{goal.name}</p>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Куплено за {goal.cost} pts</p>
                      </div>
                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-6 mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏅</span>
                <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>ДОСТИЖЕНИЯ</h2>
              </div>
              <span className={`text-sm font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
                {unlockedCount} / {ACHIEVEMENTS.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className={`w-full rounded-full h-3 overflow-hidden ${isDark ? 'bg-slate-700/50' : 'bg-slate-200/50'}`}>
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-500"
                  style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
                />
              </div>
              <p className={`text-xs text-right ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {Math.round((unlockedCount / ACHIEVEMENTS.length) * 100)}% открыто
              </p>
            </div>

            {/* Unlocked */}
            {unlockedCount > 0 && (
              <div>
                <p className={`text-xs font-bold tracking-wider mb-3 ${isDark ? 'text-violet-400/70' : 'text-violet-600/70'}`}>✨ ОТКРЫТЫЕ</p>
                <div className="grid grid-cols-2 gap-3">
                  {ACHIEVEMENTS.filter(a => unlockedAchievements[a.id]).map(ach => (
                    <div key={ach.id} className={`${isDark ? 'bg-violet-500/10 border-violet-400/30' : 'bg-violet-400/10 border-violet-400/40'} border rounded-xl p-4 text-center transition-all hover:scale-105`}>
                      <div className="text-3xl mb-2">{ach.icon}</div>
                      <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{ach.name}</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-violet-300/60' : 'text-violet-600/60'}`}>{ach.desc}</p>
                      <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {new Date(unlockedAchievements[ach.id]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Locked */}
            {unlockedCount < ACHIEVEMENTS.length && (
              <div>
                <p className={`text-xs font-bold tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>🔒 ЗАКРЫТЫЕ</p>
                <div className="grid grid-cols-2 gap-3">
                  {ACHIEVEMENTS.filter(a => !unlockedAchievements[a.id]).map(ach => (
                    <div key={ach.id} className={`${cardClass} border rounded-xl p-4 text-center opacity-50`}>
                      <div className="text-3xl mb-2 grayscale">🔒</div>
                      <p className={`font-bold text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{ach.name}</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{ach.desc}</p>
                    </div>
                  ))}
                </div>
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
