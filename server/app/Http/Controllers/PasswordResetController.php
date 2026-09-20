<?php

namespace App\Http\Controllers;

use App\Http\Requests\ResetPasswordRequest;
use App\Http\Requests\SendResetLinkRequest;
use App\Services\PasswordResetService;
use App\Traits\ApiResponse;
use Illuminate\Support\Facades\Password;

class PasswordResetController
{
    use ApiResponse;

    public function __construct(
        private readonly PasswordResetService $passwordResetService
    ) {}

    public function sendResetLink(SendResetLinkRequest $request)
    {
        $this->passwordResetService->sendResetLink($request->validated()['email']);

        return $this->sendResponse(null, 'Jika email tersebut terdaftar, kami telah mengirim tautan reset kata sandi.');
    }

    public function resetPassword(ResetPasswordRequest $request)
    {
        $status = $this->passwordResetService->resetPassword($request->validated());

        if ($status === Password::PASSWORD_RESET) {
            return $this->sendResponse(null, 'Kata sandi berhasil direset.');
        }

        return $this->sendError('Tidak dapat mereset kata sandi. Token mungkin tidak valid atau sudah kedaluwarsa.', 400);
    }
}
