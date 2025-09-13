<?php
require_once __DIR__ . '/../helpers.php';

class ScheduleModel {
    private $conn;
    public function __construct($conn) {
        $this->conn = $conn;
    }

    public function getScheduleById($id) {
        $stmt = prepareExecute($this->conn, "SELECT * FROM schedules WHERE id = ?", "i", [$id]);
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        $stmt->close();
        if ($row) {
            $row['accept_deadline'] = $row['acceptance_end'] ?? null;
        }
        return $row;
    }

    public function getSchedules($filters = []) {
        $archived    = $filters['archived']    ?? 0;
        $city        = $filters['city']        ?? '';
        $warehouse   = $filters['warehouse']   ?? '';
        $date        = $filters['date']        ?? '';
        $deliveryDate= $filters['delivery_date'] ?? '';
        $status      = $filters['status']      ?? '';
        $idParam     = $filters['id']          ?? '';
        $marketplace = $filters['marketplace'] ?? '';

        $query  = "SELECT * FROM schedules WHERE archived = ?";
        $params = [$archived];
        $types  = 'i';

        if ($city) {
            $query    .= " AND city LIKE ?";
            $params[]  = "%$city%";
            $types    .= 's';
        }
        if ($warehouse) {
            $query    .= " AND warehouses LIKE ?";
            $params[]  = "%$warehouse%";
            $types    .= 's';
        }
        if ($date) {
            $query    .= " AND accept_date = ?";
            $params[]  = $date;
            $types    .= 's';
        }
        if ($deliveryDate) {
            $query    .= " AND delivery_date = ?";
            $params[]  = $deliveryDate;
            $types    .= 's';
        }
        if ($status) {
            $query    .= " AND status = ?";
            $params[]  = $status;
            $types    .= 's';
        } else {
            // по умолчанию исключаем завершённые отправления
            $query    .= " AND status <> 'Завершено'";
        }
        if ($idParam !== '') {
            $query    .= " AND id = ?";
            $params[]  = (int)$idParam;
            $types    .= 'i';
        }
        if ($marketplace !== '') {
            $query    .= " AND marketplace = ?";
            $params[]  = $marketplace;
            $types    .= 's';
        }

        $stmt = prepareExecute($this->conn, $query, $types, $params);
        $result = $stmt->get_result();
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $row['accept_deadline'] = $row['acceptance_end'] ?? null;
            $data[] = $row;
        }
        $stmt->close();
        return $data;
    }

    public function createSchedule($data) {
        $city            = $data['city']            ?? '';
        $accept_date     = $data['accept_date']     ?? '';
        $accept_time     = $data['accept_time']     ?? '';
        $delivery_date   = $data['delivery_date']   ?? '';
        $warehousesArr   = $data['warehouses']      ?? [];
        $marketplace     = $data['marketplace']     ?? 'None';
        $timeslot        = $data['timeslot']        ?? null;
        $car_number      = $data['car_number']      ?? '';
        $driver_name     = $data['driver_name']     ?? '';
        $driver_phone    = $data['driver_phone']    ?? '';
        $car_brand       = $data['car_brand']       ?? '';
        $accept_deadline = $data['accept_deadline'] ?? '';
        $statusVal       = 'Приём заявок';

        if (!$city || !$accept_date || !$delivery_date || !$accept_deadline) {
            throw new Exception('Заполните все обязательные поля');
        }
        if (strtotime($delivery_date) < strtotime($accept_date)) {
            throw new Exception('Сдача не может быть раньше приёмки');
        }

        foreach ($warehousesArr as $warehouseName) {
            $stmt = prepareExecute(
                $this->conn,
                "INSERT INTO schedules (
                    city, accept_date, accept_time, delivery_date, warehouses,
                    timeslot, status, marketplace, car_number, driver_name,
                    driver_phone, car_brand, acceptance_end
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                "sssssssssssss",
                [
                    $city,
                    $accept_date,
                    $accept_time,
                    $delivery_date,
                    $warehouseName,
                    $timeslot,
                    $statusVal,
                    $marketplace,
                    $car_number,
                    $driver_name,
                    $driver_phone,
                    $car_brand,
                    $accept_deadline
                ]
            );
            $stmt->close();
        }
        return true;
    }

    public function updateSchedule($id, $data) {
        $stmt = prepareExecute($this->conn, "SELECT * FROM schedules WHERE id=? LIMIT 1", "i", [$id]);
        $oldRow = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$oldRow) {
            throw new Exception('Запись не найдена');
        }

        $city            = $data['city']            ?? $oldRow['city'];
        $accept_date     = $data['accept_date']     ?? $oldRow['accept_date'];
        $accept_time     = $data['accept_time']     ?? $oldRow['accept_time'];
        $delivery_date   = $data['delivery_date']   ?? $oldRow['delivery_date'];
        $warehousesArr   = $data['warehouses']      ?? explode(',', $oldRow['warehouses']);
        $timeslot        = $data['timeslot']        ?? $oldRow['timeslot'];
        $statusVal       = $data['status']          ?? $oldRow['status'];
        $marketplace     = $data['marketplace']     ?? $oldRow['marketplace'];
        $car_number      = $data['car_number']      ?? $oldRow['car_number'];
        $driver_name     = $data['driver_name']     ?? $oldRow['driver_name'];
        $driver_phone    = $data['driver_phone']    ?? $oldRow['driver_phone'];
        $car_brand       = $data['car_brand']       ?? $oldRow['car_brand'];
        $accept_deadline = $data['accept_deadline'] ?? $oldRow['acceptance_end'];

        if (!$city || !$accept_date || !$delivery_date || !$accept_deadline) {
            throw new Exception('Отсутствуют обязательные поля');
        }
        $warehousesStr = implode(',', $warehousesArr);
        $stmt = prepareExecute(
            $this->conn,
            "UPDATE schedules SET
                city = ?, accept_date = ?, accept_time = ?, delivery_date = ?, warehouses = ?,
                timeslot = ?, status = ?, marketplace = ?, car_number = ?, driver_name = ?,
                driver_phone = ?, car_brand = ?, acceptance_end = ?
            WHERE id = ?",
            "sssssssssssssi",
            [
                $city, $accept_date, $accept_time, $delivery_date, $warehousesStr,
                $timeslot, $statusVal, $marketplace, $car_number, $driver_name,
                $driver_phone, $car_brand, $accept_deadline, $id
            ]
        );
        $stmt->close();
        return true;
    }

    public function deleteOrArchive($id) {
        $stmt = prepareExecute($this->conn, "SELECT status FROM orders WHERE schedule_id = ?", "i", [$id]);
        $res = $stmt->get_result();
        $statuses = [];
        while ($row = $res->fetch_assoc()) {
            $statuses[] = trim($row['status']);
        }
        $stmt->close();
        if (empty($statuses)) {
            $del = prepareExecute($this->conn, "DELETE FROM schedules WHERE id = ?", "i", [$id]);
            $del->close();
            return ['archived' => false];
        }
        foreach ($statuses as $st) {
            if ($st !== 'Товар отправлен' && $st !== 'Завершено') {
                throw new Exception('Отправка ещё не завершена — удалить нельзя');
            }
        }
        $arch = prepareExecute($this->conn, "UPDATE schedules SET archived = 1 WHERE id = ?", "i", [$id]);
        $arch->close();
        return ['archived' => true];
    }

    public function updateStatus($id, $status) {
        $stmt = prepareExecute($this->conn, "UPDATE schedules SET status = ? WHERE id = ?", "si", [$status, $id]);
        $stmt->close();
        return true;
    }

    public function exportSchedules() {
        $result = $this->conn->query("SELECT * FROM schedules");
        $output = "ID\tГород\tДата выезда\tВремя приёма\tДата сдачи\tСклады\tТайм-слот\tСтатус\tМаркетплейс\tАвто\tВодитель\tТелефон\tМарка\tDeadline\n";
        while ($row = $result->fetch_assoc()) {
            $output .= implode("\t", [
                $row['id'],
                $row['city'],
                $row['accept_date'],
                $row['accept_time'],
                $row['delivery_date'],
                $row['warehouses'],
                $row['timeslot'],
                $row['status'],
                $row['marketplace'],
                $row['car_number'],
                $row['driver_name'],
                $row['driver_phone'],
                $row['car_brand'],
                ($row['acceptance_end'] ?? '')
            ]) . "\n";
        }
        return $output;
    }
}
