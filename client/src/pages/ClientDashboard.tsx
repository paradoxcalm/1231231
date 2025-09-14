import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Package, TrendingUp, Truck } from 'lucide-react';
import { useClientInfo, useOrders } from '../api';

const ClientDashboard: React.FC = () => {
  const userId = 1; // временно захардкожен для демонстрации
  const { data: clientInfo } = useClientInfo(userId);
  const { data: orders } = useOrders(userId);

  const stats = useMemo(() => {
    if (!clientInfo) {
      return [];
    }
    const statuses = clientInfo.statuses || {};
    return [
      {
        name: 'Активные заказы',
        value: String(statuses['Активные'] ?? 0),
        icon: Package,
        color: 'bg-blue-500',
      },
      {
        name: 'Завершено за месяц',
        value: String(statuses['Завершено'] ?? 0),
        icon: TrendingUp,
        color: 'bg-purple-500',
      },
    ];
  }, [clientInfo]);

  const upcomingShipments = useMemo(() => {
    return orders.slice(0, 2).map((o) => ({
      id: o.id,
      route: o.route,
      date: o.order_date,
      marketplace: o.marketplace,
    }));
  }, [orders]);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Личный кабинет</h1>
            <p className="text-green-100 text-lg">
              Отслеживайте свои отправления и управляйте заказами
            </p>
          </div>
          <div className="hidden lg:block">
            <Truck className="w-24 h-24 text-green-200" />
          </div>
        </div>
      </div>

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
            <div
              key={shipment.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{shipment.route}</span>
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    shipment.marketplace === 'Wildberries'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Полезные действия</h2>
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
            <h3 className="font-semibold text-gray-900 mb-1">Мои заказы</h3>
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

export default ClientDashboard;
