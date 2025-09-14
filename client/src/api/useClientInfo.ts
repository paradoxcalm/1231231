import { useEffect, useState } from 'react';
import { apiFetch } from './http';

export interface ClientInfo {
  id: number;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  registration_date: string;
  total_orders: number;
  total_sum: number;
  last_activity: string;
  statuses: Record<string, number>;
}

interface ClientInfoResponse {
  success: boolean;
  client: ClientInfo;
}

export function useClientInfo(userId: number) {
  const [data, setData] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<ClientInfoResponse>(`get_client_info.php?user_id=${userId}`)
      .then((res) => {
        if (res.success) {
          setData(res.client);
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading };
}
