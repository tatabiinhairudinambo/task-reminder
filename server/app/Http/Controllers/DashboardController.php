<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class DashboardController
{
    use ApiResponse;

    public function __construct(
        private readonly DashboardService $dashboardService
    ) {}

    public function index(Request $request)
    {
        $data = $this->dashboardService->getDashboard($request->user()->id);

        return $this->sendResponse($data, 'Data dashboard berhasil diambil');
    }

    public function chart(Request $request)
    {
        $data = $this->dashboardService->getChart($request->user()->id, (string) $request->semester);

        return $this->sendResponse($data, 'Data grafik berhasil diambil');
    }

    public function semesterOverview(Request $request)
    {
        $data = $this->dashboardService->getSemesterOverview($request->user()->id);

        return $this->sendResponse($data, 'Ringkasan semester berhasil diambil');
    }
}
