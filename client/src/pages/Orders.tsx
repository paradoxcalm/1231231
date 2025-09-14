import React, { useState, useEffect } from 'react';
import { Package, Search, Filter, Eye, Calendar, MapPin, QrCode, Download } from 'lucide-react';

interface Order {
  id: number;
  order_date: string;
  company_name: string;
  store_name: string;
  status: string;
  packaging_type: string;
  city: string;
  warehouses: string;
  delivery_date: string;
  payment: number;
  qr_code?: string;
}

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');

  const statuses = ['Выгрузите товар', 'Товар выгружен', 'Готов к обработке', 'В обработке', 'Готов к отправке', 'Товар отправлен', 'Завершено'];

  useEffect(() => {
    // Симуляция загрузки заказов
    const mockOrders: Order[] = [
      {
        id: 1234,
        order_date: '2025-01-20',
        company_name: 'ИП Иванов И.И.',
        store_name: 'Магазин игрушек',
        status: 'Готов к отправке',
        packaging_type: 'Коробка',
        city: 'Хасавюрт',
        warehouses: 'Коледино',
        delivery_date: '2025-01-25',
        payment: 3250,
        qr_code: 'ORDER_1234_abc123'
      },
      {
        id: 1235,
        order_date: '2025-01-21',
        company_name: 'ИП Петров П.П.',
        store_name: 'Одежда и обувь',
        status: 'В обработке',
        packaging_type: 'Паллета',
        city: 'Махачкала',
        warehouses: 'Электросталь',
        delivery_date: '2025-01-26',
        payment: 14500
      },
      {
        id: 1236,
        order_date: '2025-01-18',
        company_name: 'ИП Сидоров С.С.',
        store_name: 'Бытовая техника',
        status: 'Завершено',
        packaging_type: 'Коробка',
        city: 'Хасавюрт',
        warehouses: 'Тула',
        delivery_date: '2025-01-23',
        payment: 2100
      }
    ];

    setTimeout(() => {
      setOrders(mockOrders);
      setFilteredOrders(mockOrders);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    let filtered = orders;

    // Фильтр по вкладке
    if (activeTab === 'active') {
      filtered = filtered.filter(order => order.status !== 'Завершено' && order.status !== 'Товар отправлен');
    } else {
      filtered = filtered.filter(order => order.status === 'Завершено' || order.status === 'Товар отправлен');
    }

    // Поиск
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.id.toString().includes(searchTerm) ||
        order.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.store_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтр по статусу
    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter, activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Выгрузите товар': return 'bg-red-100 text-red-700';
      case 'Товар выгружен': return 'bg-yellow-100 text-yellow-700';
      case 'Готов к обработке': return 'bg-blue-100 text-blue-700';
      case 'В обработке': return 'bg-orange-100 text-orange-700';
      case 'Готов к отправке': return 'bg-green-100 text-green-700';
      case 'Товар отправлен': return 'bg-purple-100 text-purple-700';
      case 'Завершено': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const showQrCode = (qrText: string) => {
    // Простая функция для показа QR кода
    alert(`QR код: ${qrText}`);
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Мои заказы</h1>
        <p className="text-gray-600 mt-1">Отслеживайте статус и управляйте заказами</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'active'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Активные ({orders.filter(o => o.status !== 'Завершено' && o.status !== 'Товар отправлен').length})
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'archive'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Архив ({orders.filter(o => o.status === 'Завершено' || o.status === 'Товар отправлен').length})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Фильтры и поиск</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Поиск по номеру, ИП или магазину..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">Все статусы</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
            }}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Сбросить
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Заказ #{order.id}</h3>
                <p className="text-sm text-gray-600">{new Date(order.order_date).toLocaleDateString('ru-RU')}</p>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">ИП:</span>
                <p className="font-medium text-gray-900">{order.company_name}</p>
              </div>
              
              <div>
                <span className="text-gray-500">Магазин:</span>
                <p className="font-medium text-gray-900">{order.store_name}</p>
              </div>
              
              <div>
                <span className="text-gray-500">Направление:</span>
                <p className="font-medium text-gray-900">{order.city} → {order.warehouses}</p>
              </div>
              
              <div>
                <span className="text-gray-500">Стоимость:</span>
                <p className="font-medium text-gray-900">{order.payment.toLocaleString()} ₽</p>
              </div>
            </div>
            
            {order.qr_code && order.status !== 'Завершено' && (
              <div className="mt-4 flex items-center justify-center">
                <button
                  onClick={() => showQrCode(order.qr_code!)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Показать QR код</span>
                </button>
              </div>
            )}
          </div>
        ))}
        
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Заказы не найдены</h3>
            <p className="text-gray-600">
              {activeTab === 'active' 
                ? 'У вас пока нет активных заказов' 
                : 'Архив заказов пуст'
              }
            </p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Заказ #{selectedOrder.id}</h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Основная информация</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Дата создания:</span>
                      <span className="font-medium">{new Date(selectedOrder.order_date).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ИП:</span>
                      <span className="font-medium">{selectedOrder.company_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Магазин:</span>
                      <span className="font-medium">{selectedOrder.store_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Тип упаковки:</span>
                      <span className="font-medium">{selectedOrder.packaging_type}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Доставка</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Направление:</span>
                      <span className="font-medium">{selectedOrder.city} → {selectedOrder.warehouses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Дата сдачи:</span>
                      <span className="font-medium">{new Date(selectedOrder.delivery_date).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Стоимость:</span>
                      <span className="font-medium text-green-600">{selectedOrder.payment.toLocaleString()} ₽</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Статус:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedOrder.qr_code && selectedOrder.status !== 'Завершено' && (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <h3 className="font-semibold text-gray-900 mb-3">QR код для приёмки</h3>
                  <div className="bg-white rounded-lg p-4 inline-block border-2 border-dashed border-gray-300">
                    <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                      <QrCode className="w-16 h-16 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Покажите этот QR код менеджеру при приёмке товара
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;