import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Filter, Truck, Package } from 'lucide-react';

interface Shipment {
  id: number;
  city: string;
  warehouses: string;
  accept_date: string;
  delivery_date: string;
  marketplace: string;
  status: string;
  driver_name?: string;
  car_number?: string;
  orders_count: number;
}

const Schedule: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const cities = ['Хасавюрт', 'Махачкала', 'Кизляр', 'Астрахань'];
  const marketplaces = ['Wildberries', 'Ozon', 'YandexMarket'];

  useEffect(() => {
    // Симуляция загрузки данных
    const mockData: Shipment[] = [
      {
        id: 1,
        city: 'Хасавюрт',
        warehouses: 'Коледино',
        accept_date: '2025-01-25',
        delivery_date: '2025-01-27',
        marketplace: 'Wildberries',
        status: 'Приём заявок',
        driver_name: 'Иванов И.И.',
        car_number: 'А123АА05',
        orders_count: 5
      },
      {
        id: 2,
        city: 'Махачкала',
        warehouses: 'Электросталь',
        accept_date: '2025-01-26',
        delivery_date: '2025-01-28',
        marketplace: 'Ozon',
        status: 'В пути',
        driver_name: 'Петров П.П.',
        car_number: 'В456ВВ05',
        orders_count: 3
      },
      {
        id: 3,
        city: 'Хасавюрт',
        warehouses: 'Тула',
        accept_date: '2025-01-27',
        delivery_date: '2025-01-29',
        marketplace: 'YandexMarket',
        status: 'Ожидает отправки',
        orders_count: 8
      }
    ];

    setTimeout(() => {
      setShipments(mockData);
      setFilteredShipments(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    let filtered = shipments;
    
    if (selectedCity) {
      filtered = filtered.filter(s => s.city === selectedCity);
    }
    
    if (selectedMarketplace) {
      filtered = filtered.filter(s => s.marketplace === selectedMarketplace);
    }
    
    setFilteredShipments(filtered);
  }, [shipments, selectedCity, selectedMarketplace]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Приём заявок': return 'bg-green-100 text-green-700';
      case 'В пути': return 'bg-blue-100 text-blue-700';
      case 'Ожидает отправки': return 'bg-yellow-100 text-yellow-700';
      case 'Завершено': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getMarketplaceColor = (marketplace: string) => {
    switch (marketplace) {
      case 'Wildberries': return 'bg-purple-100 text-purple-700';
      case 'Ozon': return 'bg-blue-100 text-blue-700';
      case 'YandexMarket': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Расписание отправлений</h1>
          <p className="text-gray-600 mt-1">Планируйте и отслеживайте доставки</p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              viewMode === 'list'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Список
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              viewMode === 'calendar'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Календарь
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Фильтры</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Город</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Все города</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Маркетплейс</label>
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Все маркетплейсы</option>
              {marketplaces.map(mp => (
                <option key={mp} value={mp}>{mp}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedCity('');
                setSelectedMarketplace('');
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {filteredShipments.map((shipment) => (
            <div
              key={shipment.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-5 h-5 text-green-600" />
                      <span className="text-lg font-semibold text-gray-900">
                        {shipment.city} → {shipment.warehouses}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getMarketplaceColor(shipment.marketplace)}`}>
                      {shipment.marketplace}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Приём: {new Date(shipment.accept_date).toLocaleDateString('ru-RU')}
                    </div>
                    <div className="flex items-center">
                      <Truck className="w-4 h-4 mr-2" />
                      Сдача: {new Date(shipment.delivery_date).toLocaleDateString('ru-RU')}
                    </div>
                    <div className="flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      Заказов: {shipment.orders_count}
                    </div>
                  </div>
                  
                  {shipment.driver_name && (
                    <div className="mt-3 text-sm text-gray-600">
                      <span className="font-medium">Водитель:</span> {shipment.driver_name}
                      {shipment.car_number && ` (${shipment.car_number})`}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end space-y-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                    {shipment.status}
                  </span>
                  
                  {shipment.status === 'Приём заявок' && (
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors group-hover:scale-105 duration-200">
                      Создать заявку
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredShipments.length === 0 && (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет отправлений</h3>
              <p className="text-gray-600">По выбранным фильтрам отправления не найдены</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Календарный вид</h3>
            <p className="text-gray-600">Функция календаря в разработке</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;