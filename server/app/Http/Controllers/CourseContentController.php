<?php

namespace App\Http\Controllers;

use App\Http\Requests\ClearSemesterRequest;
use App\Http\Requests\ImportCourseContentRequest;
use App\Http\Requests\StoreCourseContentRequest;
use App\Http\Requests\SyncScheduleRequest;
use App\Http\Requests\UpdateCourseContentRequest;
use App\Services\CourseContentService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class CourseContentController
{
    use ApiResponse;

    public function __construct(
        private readonly CourseContentService $courseContentService
    ) {}

    public function store(StoreCourseContentRequest $request)
    {
        try {
            $courseContent = $this->courseContentService->create($request->user()->id, $request->validated());
        } catch (\Exception $e) {
            return $this->sendError($e->getMessage(), (int) $e->getCode() ?: 409);
        }

        return $this->sendResponse($courseContent, 'Mata kuliah berhasil dibuat', 201);
    }

    public function update(UpdateCourseContentRequest $request, $id)
    {
        try {
            $courseContent = $this->courseContentService->update($request->user()->id, (int) $id, $request->validated());
        } catch (\Exception $e) {
            return $this->sendError($e->getMessage(), (int) $e->getCode() ?: 404);
        }

        return $this->sendResponse($courseContent, 'Mata kuliah berhasil diperbarui');
    }

    public function destroy(Request $request, $id)
    {
        try {
            $this->courseContentService->delete($request->user()->id, (int) $id);
        } catch (\Exception $e) {
            return $this->sendError('Mata kuliah tidak ditemukan', 404);
        }

        return $this->sendResponse(null, 'Mata kuliah berhasil dihapus');
    }

    public function filter(Request $request)
    {
        $data = $this->courseContentService->filter($request->user()->id, (string) $request->semester);

        return $this->sendResponse($data, 'Data mata kuliah berhasil diambil');
    }

    public function syncSchedule(SyncScheduleRequest $request)
    {
        try {
            $result = $this->courseContentService->syncScheduleFromSiakang(
                $request->user()->id,
                $request->validated()['semester'] ?? null,
                $request->validated()['source_semester'] ?? null
            );
        } catch (\Exception $e) {
            return $this->sendError($e->getMessage(), (int) $e->getCode() ?: 500);
        }

        return $this->sendResponse(
            $result,
            "{$result['inserted']} jadwal diimpor, ".count($result['skipped']).' dilewati'
        );
    }

    public function clear(ClearSemesterRequest $request)
    {
        $result = $this->courseContentService->clearSemester(
            $request->user()->id,
            $request->validated()['semester']
        );

        return $this->sendResponse(
            $result,
            "{$result['deleted_courses']} mata kuliah dan {$result['deleted_tasks']} tugas dihapus dari {$result['semester']}"
        );
    }

    public function downloadTemplate()
    {
        $filePath = public_path('templates/course_content_template.xlsx');

        if (! file_exists($filePath)) {
            return $this->sendError('File template tidak ditemukan', 404);
        }

        return response()->download($filePath, 'course_content_template.xlsx');
    }

    public function importFromExcel(ImportCourseContentRequest $request)
    {
        try {
            $result = $this->courseContentService->importFromExcel($request->user()->id, $request->file('file'));

            return $this->sendResponse($result['data'], $result['message'], $result['status']);
        } catch (\RuntimeException $e) {
            [$message, $headingError] = explode('|', $e->getMessage(), 2);

            return $this->sendError($message, 422, ['headings' => $headingError]);
        } catch (\Exception $e) {
            return $this->sendError($e->getMessage(), (int) $e->getCode() ?: 422);
        }
    }
}
