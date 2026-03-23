import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Car, 
  Wrench, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  XCircle,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Filter,
  Download,
  Calendar,
  DollarSign,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, type Vehicle, type Maintenance, type Tab } from './types';

// --- Mock Data ---
const INITIAL_VEHICLES: Vehicle[] = [
  { id: '1', plate: 'ABC-1234', brand: 'Toyota', model: 'Corolla', year: 2022, currentKm: 15000, color: 'Prata', status: 'Ativo' },
  { id: '2', plate: 'XYZ-5678', brand: 'Volkswagen', model: 'Gol', year: 2020, currentKm: 45000, color: 'Branco', status: 'Em manutenção' },
];

const INITIAL_MAINTENANCES: Maintenance[] = [
  { id: '1', vehicleId: '1', vehiclePlate: 'ABC-1234', date: '2024-03-15', type: 'Troca de Óleo', description: 'Troca de óleo sintético e filtro', km: 14500, value: 350.00, workshop: 'Auto Center Premium', status: 'Concluída' },
  { id: '2', vehicleId: '2', vehiclePlate: 'XYZ-5678', date: '2024-03-18', type: 'Revisão Geral', description: 'Freios, suspensão e alinhamento', km: 44800, value: 1250.00, workshop: 'Oficina do Zé', status: 'Pendente' },
];

// --- Components ---

const Notification = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className={cn(
      "fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50",
      type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
    )}
  >
    {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
    <span className="font-medium">{message}</span>
    <button onClick={onClose} className="ml-4 opacity-70 hover:opacity-100"><XCircle size={18} /></button>
  </motion.div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem('vehicles');
    return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
  });
  const [maintenances, setMaintenances] = useState<Maintenance[]>(() => {
    const saved = localStorage.getItem('maintenances');
    return saved ? JSON.parse(saved) : INITIAL_MAINTENANCES;
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Form States
  const [vehicleForm, setVehicleForm] = useState<Partial<Vehicle>>({});
  const [maintenanceForm, setMaintenanceForm] = useState<Partial<Maintenance>>({});
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [isEditingMaintenance, setIsEditingMaintenance] = useState(false);

  // Search & Filter States
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [maintenanceSearch, setMaintenanceSearch] = useState('');
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState<string>('Todos');
  const [pdfVehicleFilter, setPdfVehicleFilter] = useState<string>('Todos');

  useEffect(() => {
    localStorage.setItem('vehicles', JSON.stringify(vehicles));
    localStorage.setItem('maintenances', JSON.stringify(maintenances));
  }, [vehicles, maintenances]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // --- Dashboard Logic ---
  const stats = useMemo(() => {
    const totalVehicles = vehicles.length;
    const totalMaintenances = maintenances.length;
    const pendingMaintenances = maintenances.filter(m => m.status === 'Pendente').length;
    const totalSpent = maintenances.reduce((acc, m) => m.status === 'Concluída' ? acc + m.value : acc, 0);
    return { totalVehicles, totalMaintenances, pendingMaintenances, totalSpent };
  }, [vehicles, maintenances]);

  const recentMaintenances = useMemo(() => {
    return [...maintenances].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [maintenances]);

  // --- Vehicle Logic ---
  const filteredVehicles = useMemo(() => {
    const s = vehicleSearch.toLowerCase();
    return vehicles.filter(v => 
      v.plate.toLowerCase().includes(s) ||
      v.brand.toLowerCase().includes(s) ||
      v.model.toLowerCase().includes(s) ||
      v.color.toLowerCase().includes(s) ||
      v.status.toLowerCase().includes(s)
    );
  }, [vehicles, vehicleSearch]);

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const { plate, brand, model, year, currentKm, color, status } = vehicleForm;
    
    if (!plate || !brand || !model || !year || !currentKm || !color || !status) {
      showNotification('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (!isEditingVehicle && vehicles.some(v => v.plate.toUpperCase() === plate.toUpperCase())) {
      showNotification('Já existe um veículo com esta placa.', 'error');
      return;
    }

    if (isEditingVehicle) {
      const oldVehicle = vehicles.find(v => v.id === vehicleForm.id);
      setVehicles(prev => prev.map(v => v.id === vehicleForm.id ? { ...v, ...vehicleForm } as Vehicle : v));
      // Update plate in maintenances if changed
      if (oldVehicle && oldVehicle.plate !== plate) {
        setMaintenances(prev => prev.map(m => m.vehicleId === oldVehicle.id ? { ...m, vehiclePlate: plate } : m));
      }
      showNotification('Veículo atualizado com sucesso!', 'success');
    } else {
      const newVehicle: Vehicle = {
        id: Math.random().toString(36).substr(2, 9),
        plate: plate.toUpperCase(),
        brand,
        model,
        year: Number(year),
        currentKm: Number(currentKm),
        color,
        status: status as any
      };
      setVehicles(prev => [...prev, newVehicle]);
      showNotification('Veículo cadastrado com sucesso!', 'success');
    }
    setVehicleForm({});
    setIsEditingVehicle(false);
  };

  const handleDeleteVehicle = (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
    setMaintenances(prev => prev.filter(m => m.vehicleId !== id));
    showNotification('Veículo e manutenções vinculadas excluídos.', 'success');
  };

  // --- Maintenance Logic ---
  const filteredMaintenances = useMemo(() => {
    const s = maintenanceSearch.toLowerCase();
    return maintenances.filter(m => {
      const matchesSearch = 
        m.vehiclePlate.toLowerCase().includes(s) ||
        m.type.toLowerCase().includes(s) ||
        m.description.toLowerCase().includes(s) ||
        m.workshop.toLowerCase().includes(s) ||
        m.status.toLowerCase().includes(s) ||
        m.date.includes(s);
      
      const matchesStatus = maintenanceStatusFilter === 'Todos' || m.status === maintenanceStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [maintenances, maintenanceSearch, maintenanceStatusFilter]);

  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    const { vehicleId, date, type, description, km, value, workshop, status } = maintenanceForm;

    if (!vehicleId || !date || !type || !description || !km || !value || !workshop || !status) {
      showNotification('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    if (isEditingMaintenance) {
      setMaintenances(prev => prev.map(m => m.id === maintenanceForm.id ? { ...m, ...maintenanceForm, vehiclePlate: vehicle.plate } as Maintenance : m));
      showNotification('Manutenção atualizada com sucesso!', 'success');
    } else {
      const newMaintenance: Maintenance = {
        id: Math.random().toString(36).substr(2, 9),
        vehicleId,
        vehiclePlate: vehicle.plate,
        date,
        type,
        description,
        km: Number(km),
        value: Number(value),
        workshop,
        status: status as any
      };
      setMaintenances(prev => [...prev, newMaintenance]);
      showNotification('Manutenção cadastrada com sucesso!', 'success');
    }
    setMaintenanceForm({});
    setIsEditingMaintenance(false);
  };

  const handleDeleteMaintenance = (id: string) => {
    setMaintenances(prev => prev.filter(m => m.id !== id));
    showNotification('Manutenção excluída.', 'success');
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const title = "Relatório de Manutenções";
    const now = format(new Date(), "dd/MM/yyyy HH:mm:ss");
    
    const dataToExport = pdfVehicleFilter === 'Todos' 
      ? maintenances 
      : maintenances.filter(m => m.vehicleId === pdfVehicleFilter);

    const totalValue = dataToExport.reduce((acc, m) => acc + m.value, 0);

    doc.setFontSize(18);
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now}`, 14, 30);
    doc.text(`Filtro: ${pdfVehicleFilter === 'Todos' ? 'Todos os veículos' : vehicles.find(v => v.id === pdfVehicleFilter)?.plate}`, 14, 35);
    doc.text(`Registros: ${dataToExport.length}`, 14, 40);
    doc.text(`Total Gasto: ${formatCurrency(totalValue)}`, 14, 45);

    const tableData = dataToExport.map(m => [
      m.vehiclePlate,
      format(new Date(m.date), 'dd/MM/yyyy'),
      m.type,
      m.description,
      m.workshop,
      m.km,
      formatCurrency(m.value),
      m.status
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Placa', 'Data', 'Tipo', 'Descrição', 'Oficina', 'KM', 'Valor', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138] }
    });

    doc.save(`relatorio-manutencoes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    showNotification('PDF exportado com sucesso!', 'success');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Wrench className="text-primary" />
              Controle de Manutenções
            </h1>
            <p className="text-slate-500 text-sm mt-1">Gestão inteligente de veículos, serviços, custos e histórico da frota.</p>
          </div>
          <div className="flex items-center gap-4 text-slate-500 text-sm bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            <Clock size={16} />
            <span>Última atualização: {format(lastUpdate, "dd/MM/yyyy HH:mm:ss")}</span>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1">
            {[
              { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
              { id: 'vehicles', label: 'Veículos', icon: Car },
              { id: 'maintenances', label: 'Manutenções', icon: Wrench },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all",
                  activeTab === tab.id 
                    ? "border-primary text-primary bg-blue-50/50" 
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total de Veículos', value: stats.totalVehicles, icon: Car, color: 'bg-blue-100 text-blue-600' },
                  { label: 'Total Manutenções', value: stats.totalMaintenances, icon: Wrench, color: 'bg-purple-100 text-purple-600' },
                  { label: 'Pendentes', value: stats.pendingMaintenances, icon: Clock, color: 'bg-warning/10 text-warning' },
                  { label: 'Total Gasto', value: formatCurrency(stats.totalSpent), icon: DollarSign, color: 'bg-success/10 text-success' },
                ].map((stat, i) => (
                  <div key={i} className="card p-6 flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl", stat.color)}>
                      <stat.icon size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Maintenances */}
              <div className="card">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800">Últimas Manutenções</h2>
                  <button 
                    onClick={() => { setLastUpdate(new Date()); showNotification('Painel atualizado!', 'success'); }}
                    className="btn-secondary text-xs py-1.5"
                  >
                    <RefreshCw size={14} />
                    Atualizar painel
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Placa</th>
                        <th className="px-6 py-4 font-semibold">Tipo</th>
                        <th className="px-6 py-4 font-semibold">Data</th>
                        <th className="px-6 py-4 font-semibold">Oficina</th>
                        <th className="px-6 py-4 font-semibold">Valor</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentMaintenances.length > 0 ? recentMaintenances.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-primary">{m.vehiclePlate}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{m.type}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(m.date), 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{m.workshop}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">{formatCurrency(m.value)}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "badge",
                              m.status === 'Concluída' ? "bg-success/10 text-success" :
                              m.status === 'Pendente' ? "bg-warning/10 text-warning" :
                              "bg-danger/10 text-danger"
                            )}>
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Nenhuma manutenção registrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'vehicles' && (
            <motion.div
              key="vehicles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Vehicle Form */}
              <div className="card p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Plus size={20} className="text-primary" />
                  {isEditingVehicle ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
                </h2>
                <form onSubmit={handleSaveVehicle} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Placa *</label>
                    <input 
                      type="text" 
                      placeholder="ABC-1234" 
                      className="input-field uppercase"
                      value={vehicleForm.plate || ''}
                      onChange={e => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Marca *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Toyota" 
                      className="input-field"
                      value={vehicleForm.brand || ''}
                      onChange={e => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Modelo *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Corolla" 
                      className="input-field"
                      value={vehicleForm.model || ''}
                      onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Ano *</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 2022" 
                      className="input-field"
                      value={vehicleForm.year || ''}
                      onChange={e => setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">KM Atual *</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 15000" 
                      className="input-field"
                      value={vehicleForm.currentKm || ''}
                      onChange={e => setVehicleForm({ ...vehicleForm, currentKm: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Cor *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Prata" 
                      className="input-field"
                      value={vehicleForm.color || ''}
                      onChange={e => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Status *</label>
                    <select 
                      className="input-field"
                      value={vehicleForm.status || ''}
                      onChange={e => setVehicleForm({ ...vehicleForm, status: e.target.value as any })}
                    >
                      <option value="">Selecionar...</option>
                      <option value="Ativo">Ativo</option>
                      <option value="Em manutenção">Em manutenção</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                  <div className="md:col-span-3 lg:col-span-4 flex gap-3 mt-2">
                    <button type="submit" className="btn-primary">
                      <CheckCircle2 size={18} />
                      {isEditingVehicle ? 'Salvar Alterações' : 'Salvar Veículo'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setVehicleForm({}); setIsEditingVehicle(false); }}
                      className="btn-secondary"
                    >
                      Limpar
                    </button>
                    {isEditingVehicle && (
                      <button 
                        type="button" 
                        onClick={() => { setVehicleForm({}); setIsEditingVehicle(false); }}
                        className="btn-secondary text-danger border-danger/20 hover:bg-danger/5"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Vehicle List Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar por placa, marca, modelo..." 
                    className="input-field pl-10"
                    value={vehicleSearch}
                    onChange={e => setVehicleSearch(e.target.value)}
                  />
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600">
                  Total: <span className="text-primary font-bold">{filteredVehicles.length}</span> veículos
                </div>
              </div>

              {/* Vehicle Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVehicles.map((v) => (
                  <motion.div 
                    layout
                    key={v.id} 
                    className="card group hover:border-primary/30 transition-all"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-primary group-hover:bg-blue-50 transition-all">
                          <Car size={32} />
                        </div>
                        <span className={cn(
                          "badge",
                          v.status === 'Ativo' ? "bg-success/10 text-success" :
                          v.status === 'Em manutenção' ? "bg-warning/10 text-warning" :
                          "bg-danger/10 text-danger"
                        )}>
                          {v.status}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase mb-1">{v.plate}</h3>
                      <p className="text-slate-600 font-medium">{v.brand} {v.model}</p>
                      
                      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Ano</p>
                          <p className="text-sm font-semibold text-slate-700">{v.year}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">KM Atual</p>
                          <p className="text-sm font-semibold text-slate-700">{v.currentKm.toLocaleString()} km</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Cor</p>
                          <p className="text-sm font-semibold text-slate-700">{v.color}</p>
                        </div>
                      </div>

                      <div className="mt-6 flex gap-2">
                        <button 
                          onClick={() => { setVehicleForm(v); setIsEditingVehicle(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="flex-1 btn-secondary justify-center py-2 text-xs"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteVehicle(v.id)}
                          className="btn-secondary text-danger border-danger/20 hover:bg-danger/5 px-3"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center gap-2 text-[10px] font-medium text-slate-400">
                      <FileText size={12} />
                      Espaço reservado para foto do veículo
                    </div>
                  </motion.div>
                ))}
                {filteredVehicles.length === 0 && (
                  <div className="col-span-full py-20 text-center card bg-slate-50/50 border-dashed">
                    <Car size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">Nenhum veículo encontrado.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'maintenances' && (
            <motion.div
              key="maintenances"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Maintenance Form */}
              <div className="card p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Plus size={20} className="text-primary" />
                  {isEditingMaintenance ? 'Editar Manutenção' : 'Cadastrar Nova Manutenção'}
                </h2>
                <form onSubmit={handleSaveMaintenance} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Veículo *</label>
                    <select 
                      className="input-field"
                      value={maintenanceForm.vehicleId || ''}
                      onChange={e => setMaintenanceForm({ ...maintenanceForm, vehicleId: e.target.value })}
                    >
                      <option value="">Selecionar...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Data *</label>
                    <input 
                      type="date" 
                      className="input-field"
                      value={maintenanceForm.date || ''}
                      onChange={e => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Tipo *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Troca de Óleo" 
                      className="input-field"
                      value={maintenanceForm.type || ''}
                      onChange={e => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">KM *</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 14500" 
                      className="input-field"
                      value={maintenanceForm.km || ''}
                      onChange={e => setMaintenanceForm({ ...maintenanceForm, km: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Valor (R$) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="Ex: 350.00" 
                      className="input-field"
                      value={maintenanceForm.value || ''}
                      onChange={e => setMaintenanceForm({ ...maintenanceForm, value: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Oficina *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Auto Center" 
                      className="input-field"
                      value={maintenanceForm.workshop || ''}
                      onChange={e => setMaintenanceForm({ ...maintenanceForm, workshop: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Status *</label>
                    <select 
                      className="input-field"
                      value={maintenanceForm.status || ''}
                      onChange={e => setMaintenanceForm({ ...maintenanceForm, status: e.target.value as any })}
                    >
                      <option value="">Selecionar...</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Concluída">Concluída</option>
                      <option value="Cancelada">Cancelada</option>
                    </select>
                  </div>
                  <div className="md:col-span-3 lg:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Descrição *</label>
                    <textarea 
                      placeholder="Detalhes do serviço realizado..." 
                      className="input-field min-h-[80px]"
                      value={maintenanceForm.description || ''}
                      onChange={e => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3 lg:col-span-4 flex flex-wrap gap-3 mt-2">
                    <button type="submit" className="btn-primary">
                      <CheckCircle2 size={18} />
                      {isEditingMaintenance ? 'Salvar Alterações' : 'Salvar Manutenção'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setMaintenanceForm({}); setIsEditingMaintenance(false); }}
                      className="btn-secondary"
                    >
                      Limpar
                    </button>
                    {isEditingMaintenance && (
                      <button 
                        type="button" 
                        onClick={() => { setMaintenanceForm({}); setIsEditingMaintenance(false); }}
                        className="btn-secondary text-danger border-danger/20 hover:bg-danger/5"
                      >
                        Cancelar Edição
                      </button>
                    )}
                    <div className="flex-1"></div>
                    <div className="flex items-center gap-2">
                      <select 
                        className="input-field py-1.5 text-xs w-40"
                        value={pdfVehicleFilter}
                        onChange={e => setPdfVehicleFilter(e.target.value)}
                      >
                        <option value="Todos">Todos os veículos</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.plate}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        onClick={exportPDF}
                        className="btn-secondary text-primary border-primary/20 hover:bg-blue-50"
                      >
                        <Download size={18} />
                        Exportar PDF
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Filters & Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar por placa, tipo, oficina..." 
                      className="input-field pl-10"
                      value={maintenanceSearch}
                      onChange={e => setMaintenanceSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <Filter size={16} className="text-slate-400" />
                    <select 
                      className="bg-transparent text-sm font-medium text-slate-600 focus:outline-none"
                      value={maintenanceStatusFilter}
                      onChange={e => setMaintenanceStatusFilter(e.target.value)}
                    >
                      <option value="Todos">Todos Status</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Concluída">Concluída</option>
                      <option value="Cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 card p-4 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-primary rounded-lg">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                      <p className="text-lg font-bold text-slate-900">{filteredMaintenances.length}</p>
                    </div>
                  </div>
                  <div className="flex-1 card p-4 flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-success rounded-lg">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Gasto</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(filteredMaintenances.reduce((acc, m) => acc + m.value, 0))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maintenance Table */}
              <div className="card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Placa</th>
                        <th className="px-6 py-4 font-semibold">Data</th>
                        <th className="px-6 py-4 font-semibold">Tipo</th>
                        <th className="px-6 py-4 font-semibold">Oficina</th>
                        <th className="px-6 py-4 font-semibold">KM</th>
                        <th className="px-6 py-4 font-semibold">Valor</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMaintenances.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-primary">{m.vehiclePlate}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(m.date), 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">{m.type}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{m.workshop}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{m.km.toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(m.value)}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "badge",
                              m.status === 'Concluída' ? "bg-success/10 text-success" :
                              m.status === 'Pendente' ? "bg-warning/10 text-warning" :
                              "bg-danger/10 text-danger"
                            )}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => { setMaintenanceForm(m); setIsEditingMaintenance(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteMaintenance(m.id)}
                                className="p-1.5 text-slate-400 hover:text-danger transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredMaintenances.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-20 text-center text-slate-400">Nenhuma manutenção encontrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">
            © 2026 Controle de Manutenções • Sistema de Gestão Automotiva
          </p>
        </div>
      </footer>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <Notification 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
