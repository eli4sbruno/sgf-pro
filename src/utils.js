import { Cat, Dog, Bird, Bot } from 'lucide-react';

export const CATEGORIES = ['Infraestrutura', 'Salários', 'Impostos', 'Marketing', 'Software', 'Material', 'Serviços', 'Vendas', 'Outros'];
export const COST_CENTERS = ['Administrativo', 'Operacional', 'Financeiro', 'RH', 'Comercial'];

export const MASCOTS = [
    { id: 'cat', icon: Cat, color: 'bg-orange-100 text-orange-600', label: 'Gato' },
    { id: 'dog', icon: Dog, color: 'bg-blue-100 text-blue-600', label: 'Cachorro' },
    { id: 'bird', icon: Bird, color: 'bg-green-100 text-green-600', label: 'Pássaro' },
    { id: 'bot', icon: Bot, color: 'bg-purple-100 text-purple-600', label: 'Robô' },
];

export const formatCurrency = (value) => {
  if (value === undefined || value === null || value === '') return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  if (dateString.seconds) {
      return new Date(dateString.seconds * 1000).toLocaleDateString('pt-BR');
  }
  const date = new Date(dateString);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
};

export const generatePixPayload = (key, value, description, name, city) => {
  const id = `TXID${Math.floor(Math.random() * 100000)}`;
  const val = parseFloat(value) || 0;
  // Payload simplificado para exemplo. Em produção, use uma lib como 'pix-payload'
  return `00020126580014BR.GOV.BCB.PIX0136${key}520400005303986540${val.toFixed(2).replace('.', '').padStart(2, '0')}5802BR59${name.length}${name}60${city.length}${city}62${(description || '').length + 4}05${description || ''}6304${id}`;
};