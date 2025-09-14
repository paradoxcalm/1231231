import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Package, TrendingUp, Clock, MapPin, Truck } from 'lucide-react';

const Dashboard: React.FC = () => {
  const stats = [
    { name: 'Активные заказы', value: '12', icon: Package, color: 'bg-blue-500' },
    { name: 'Ближайшие отправления', value: '3', icon: Truck, color: 'bg-green-500' },
    { name: 'В пути', value: '7', icon: MapPin, color: 'bg-orange-500' },
    { name: 'Завершено за месяц', value: '45', icon: TrendingUp, color: 'bg-purple-500' },
  ];

  const recentActivity = [
    {
      id: 1,
      action: 'Создан заказ #1234',
      time: '2 часа назад',
      status: 'success'
    },
    {
      id: 2,
      action: 'Отправление в Махачкалу',
      time: '5 часов назад',
      status: 'info'
    },
    {
      id: 3,
      action: 'Заказ #1230 доставлен',
      time: '1 день назад',
      status: 'success'
    }
  ];

  const upcomingShipments = [
    {
      id: 1,
      route: 'Хасавюрт → Коледино',
      date: 'Завтра, 15:00',
      marketplace: 'Wildberries'
    },
    {
      id: 2,
      route: 'Хасавюрт → Электросталь',
      date: '25.01, 10:00',
      marketplace: 'Ozon'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Добро пожаловать!</h1>
            <p className="text-green-100 text-lg">
              Управляйте отправлениями и отслеживайте заказы в едином интерфейсе
            </p>
          </div>
          <div className="hidden lg:block">
            <Truck className="w-24 h-24 text-green-200" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} rounded-lg p-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Последняя активность</h2>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  activity.status === 'success' ? 'bg-green-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Shipments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Ближайшие отправления</h2>
            <Link 
              to="/schedule"
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              Все →
            </Link>
          </div>
          <div className="space-y-4">
            {upcomingShipments.map((shipment) => (
              <div key={shipment.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{shipment.route}</span>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    shipment.marketplace === 'Wildberries' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {shipment.marketplace}
                  </span>
                </div>
                <p className="text-sm text-gray-600 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {shipment.date}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/schedule"
            className="group p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200"
          >
            <Calendar className="w-8 h-8 text-green-600 mb-3 group-hover:scale-110 transition-transform duration-200" />
            <h3 className="font-semibold text-gray-900 mb-1">Посмотреть расписание</h3>
            <p className="text-sm text-gray-600">Планируйте отправления</p>
          </Link>
          
          <Link
            to="/orders"
            className="group p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200"
          >
            <Package className="w-8 h-8 text-green-600 mb-3 group-hover:scale-110 transition-transform duration-200" />
            <h3 className="font-semibold text-gray-900 mb-1">Управление заказами</h3>
            <p className="text-sm text-gray-600">Отслеживайте статусы</p>
          </Link>
          
          <Link
            to="/tariffs"
            className="group p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200"
          >
            <CreditCard className="w-8 h-8 text-green-600 mb-3 group-hover:scale-110 transition-transform duration-200" />
            <h3 className="font-semibold text-gray-900 mb-1">Узнать тарифы</h3>
            <p className="text-sm text-gray-600">Рассчитайте стоимость</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;