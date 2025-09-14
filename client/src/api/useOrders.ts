import { useEffect, useState } from 'react';
import { apiFetch } from './http';

export interface Order {
  id: number;
  route: string;
  status: string;
  marketplace: string;
  order_date: string;
}

interface OrdersResponse {
  success: boolean;
  orders: Order[];
}

export function useOrders(userId: number) {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<OrdersResponse>(`get_orders.php?user_id=${userId}`)
      .then((res) => {
        if (res.success) {
          setData(res.orders);
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading };
}
