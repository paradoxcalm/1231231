import React, { useState, useEffect } from 'react';
import { Package, Truck, Calculator, Info } from 'lucide-react';

interface TariffData {
  [city: string]: {
    [warehouse: string]: {
      box_price: number;
      pallet_price: number;
    };
  };
}

const Tariffs: React.FC = () => {
  const [tariffs, setTariffs] = useState<TariffData>({});
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculation, setCalculation] = useState({
    city: '',
    warehouse: '',
    type: 'box',
    quantity: 1,
    result: 0
  });

  useEffect(() => {
    // Симуляция загрузки тарифов
    const mockTariffs: TariffData = {
      'Хасавюрт': {
        'Коледино': { box_price: 650, pallet_price: 7000 },
        'Электросталь': { box_price: 680, pallet_price: 7200 },
        'Тула': { box_price: 620, pallet_price: 6800 },
        'Казань': { box_price: 700, pallet_price: 7500 }
      },
      'Махачкала': {
        'Коледино': { box_price: 670, pallet_price: 7100 },
        'Электросталь': { box_price: 690, pallet_price: 7300 },
        'Тула': { box_price: 640, pallet_price: 6900 }
      },
      'Кизляр': {
        'Коледино': { box_price: 680, pallet_price: 7200 },
        'Невинномысск': { box_price: 720, pallet_price: 7600 }
      }
    };

    setTimeout(() => {
      setTariffs(mockTariffs);
      setSelectedCity(Object.keys(mockTariffs)[0]);
      setLoading(false);
    }, 800);
  }, []);

  const cities = Object.keys(tariffs);

  const calculateCost = () => {
    if (!calculation.city || !calculation.warehouse) {
      setCalculation(prev => ({ ...prev, result: 0 }));
      return;
    }

    const cityData = tariffs[calculation.city];
    if (!cityData || !cityData[calculation.warehouse]) {
      setCalculation(prev => ({ ...prev, result: 0 }));
      return;
    }

    const price = calculation.type === 'box' 
      ? cityData[calculation.warehouse].box_price 
      : cityData[calculation.warehouse].pallet_price;

    const result = price * calculation.quantity;
    setCalculation(prev => ({ ...prev, result }));
  };

  useEffect(() => {
    calculateCost();
  }, [calculation.city, calculation.warehouse, calculation.type, calculation.quantity, tariffs]);

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
          <h1 className="text-3xl font-bold text-gray-900">Тарифы</h1>
          <p className="text-gray-600 mt-1">Стоимость доставки по направлениям</p>
        </div>
        
        <button
          onClick={() => setCalculatorOpen(!calculatorOpen)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Calculator className="w-4 h-4" />
          <span>Калькулятор</span>
        </button>
      </div>

      {/* Calculator */}
      {calculatorOpen && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-green-600" />
            Калькулятор стоимости
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Город</label>
              <select
                value={calculation.city}
                onChange={(e) => setCalculation(prev => ({ ...prev, city: e.target.value, warehouse: '' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Выберите город</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Склад</label>
              <select
                value={calculation.warehouse}
                onChange={(e) => setCalculation(prev => ({ ...prev, warehouse: e.target.value }))}
                disabled={!calculation.city}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">Выберите склад</option>
                {calculation.city && tariffs[calculation.city] && Object.keys(tariffs[calculation.city]).map(warehouse => (
                  <option key={warehouse} value={warehouse}>{warehouse}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Тип</label>
              <select
                value={calculation.type}
                onChange={(e) => setCalculation(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="box">Коробка</option>
                <option value="pallet">Паллета</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Количество</label>
              <input
                type="number"
                min="1"
                value={calculation.quantity}
                onChange={(e) => setCalculation(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {calculation.result > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-green-800 font-medium">Стоимость доставки:</span>
                <span className="text-2xl font-bold text-green-600">{calculation.result.toLocaleString()} ₽</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* City Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {cities.map(city => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                selectedCity === city
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* Tariffs Table */}
        {selectedCity && tariffs[selectedCity] && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 border-b border-gray-200">
                    Склад назначения
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900 border-b border-gray-200">
                    <div className="flex items-center justify-center">
                      <Package className="w-4 h-4 mr-1" />
                      Коробка
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900 border-b border-gray-200">
                    <div className="flex items-center justify-center">
                      <Truck className="w-4 h-4 mr-1" />
                      Паллета
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tariffs[selectedCity]).map(([warehouse, prices]) => (
                  <tr key={warehouse} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 font-medium text-gray-900 border-b border-gray-100">
                      {warehouse}
                    </td>
                    <td className="py-4 px-4 text-center border-b border-gray-100">
                      <span className="text-lg font-semibold text-green-600">
                        {prices.box_price.toLocaleString()} ₽
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center border-b border-gray-100">
                      <span className="text-lg font-semibold text-green-600">
                        {prices.pallet_price.toLocaleString()} ₽
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Информация о тарифах</h4>
              <p className="text-sm text-blue-700">
                Цены указаны за единицу упаковки. Стоимость может изменяться в зависимости от габаритов и веса груза.
                Для точного расчёта используйте калькулятор выше.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tariffs;