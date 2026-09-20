<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Services\TaskService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class TaskController
{
    use ApiResponse;

    public function __construct(
        private readonly TaskService $taskService
    ) {}

    public function store(StoreTaskRequest $request)
    {
        try {
            $task = $this->taskService->create($request->user(), $request->validated());
        } catch (\Exception) {
            return $this->sendError('Mata kuliah tidak ditemukan', 404);
        }

        return $this->sendResponse($task, 'Tugas berhasil dibuat', 201);
    }

    public function update(UpdateTaskRequest $request, $id)
    {
        try {
            $task = $this->taskService->update($request->user()->id, (int) $id, $request->validated());
        } catch (\Exception) {
            return $this->sendError('Tugas tidak ditemukan', 404);
        }

        return $this->sendResponse($task, 'Tugas berhasil diperbarui');
    }

    public function destroy(Request $request, $id)
    {
        try {
            $this->taskService->delete($request->user()->id, (int) $id);
        } catch (\Exception) {
            return $this->sendError('Tugas tidak ditemukan', 404);
        }

        return $this->sendResponse(null, 'Tugas berhasil dihapus');
    }

    public function statusChanged(Request $request, $id)
    {
        try {
            $task = $this->taskService->toggleStatus($request->user(), (int) $id);
        } catch (\Exception) {
            return $this->sendError('Tugas tidak ditemukan', 404);
        }

        return $this->sendResponse($task, 'Status tugas berhasil diubah');
    }
}
