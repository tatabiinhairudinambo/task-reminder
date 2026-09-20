<?php

namespace App\Http\Controllers;

use App\Http\Requests\SyncAssessmentRequest;
use App\Http\Requests\UpdateAssessmentRequest;
use App\Models\Setting;
use App\Services\AssessmentService;
use App\Services\SiakangClient;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class AssessmentController
{
    use ApiResponse;

    public function __construct(
        private readonly AssessmentService $assessmentService,
        private readonly SiakangClient $siakangClient
    ) {}

    public function calculateGpa(Request $request)
    {
        $data = $this->assessmentService->calculateGpa($request->user()->id, $request->semester);

        return $this->sendResponse($data, 'Mata kuliah, IPK semester, dan IPK kumulatif berhasil diambil');
    }

    public function update(UpdateAssessmentRequest $request, $id)
    {
        $courseContent = $this->assessmentService->updateScore($request->user()->id, (int) $id, $request->validated()['score'] ?? null);

        return $this->sendResponse($courseContent, 'Skor berhasil diperbarui');
    }

    public function sync(SyncAssessmentRequest $request)
    {
        try {
            $result = $this->assessmentService->syncScoresFromSiakang(
                $request->user()->id,
                $request->validated()['semester'] ?? null,
                $request->validated()['source_semester'] ?? null
            );
        } catch (\Exception $e) {
            return $this->sendError($e->getMessage(), (int) $e->getCode() ?: 500);
        }

        $updated = $result['updated'];
        $unchanged = $result['unchanged'];
        $noMatchCount = count($result['no_match']);

        $parts = [];

        if ($updated > 0) {
            $parts[] = "{$updated} skor diperbarui";
        }

        if ($unchanged > 0) {
            $parts[] = "{$unchanged} sudah terbaru";
        }

        $message = $parts === [] ? 'Tidak ada skor yang cocok' : implode(', ', $parts);

        if ($noMatchCount > 0) {
            $message .= " — {$noMatchCount} mata kuliah tidak ditemukan di {$result['semester_label']}";
        }

        // Nothing was updated and nothing was already up to date → the source
        // semester has no matching courses. Surface this as a non-success so the
        // client shows a warning instead of a green success toast.
        if ($updated === 0 && $unchanged === 0) {
            return $this->sendError($message, 422);
        }

        return $this->sendResponse($result, $message);
    }

    public function semesters(Request $request)
    {
        $user = $request->user();
        $setting = Setting::where('user_id', $user->id)->first();

        if (! $setting?->hasSiakangCredentials()) {
            return $this->sendError('Kredensial Siakang belum diatur. Tambahkan di Pengaturan.', 422);
        }

        try {
            $response = $this->siakangClient->listSemesters(
                trim($setting->siakang_email),
                trim($setting->siakang_password)
            );
        } catch (\Exception $e) {
            return $this->sendError($e->getMessage(), (int) $e->getCode() ?: 500);
        }

        if (($response['code'] ?? 0) !== 200) {
            return $this->sendError($response['message'] ?? 'Gagal mengambil semester dari Siakang.', (int) ($response['code'] ?: 502));
        }

        return $this->sendResponse($response['data'] ?? [], 'Semester Siakang berhasil diambil');
    }
}
