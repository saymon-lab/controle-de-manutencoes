import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentKm: number;
  color: string;
  status: 'Ativo' | 'Em manutenção' | 'Inativo';
}

export interface Maintenance {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  date: string;
  type: string;
  description: string;
  km: number;
  value: number;
  workshop: string;
  status: 'Pendente' | 'Concluída' | 'Cancelada';
}

export type Tab = 'dashboard' | 'vehicles' | 'maintenances';
