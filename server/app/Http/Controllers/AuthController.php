<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Services\AuthService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class AuthController
{
    use ApiResponse;

    public function __construct(
        private readonly AuthService $authService
    ) {}

    public function login(LoginRequest $request)
    {
        try {
            $validated = $request->validated();

            $data = $this->authService->login(
                ['email' => $validated['email'], 'password' => $validated['password']],
                $request->boolean('remember_me')
            );

            return $this->sendResponse($data, 'Berhasil masuk');
        } catch (\Exception $e) {
            return $this->sendError($e->getMessage(), (int) $e->getCode() ?: 401);
        }
    }

    public function register(RegisterRequest $request)
    {
        $validated = $request->validated();

        $data = $this->authService->register([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
        ]);

        return $this->sendResponse($data, 'Pendaftaran berhasil', 201);
    }

    public function resendVerificationEmail(Request $request)
    {
        try {
            $this->authService->resendVerificationEmail($request->user());

            return $this->sendResponse(null, 'Email verifikasi berhasil dikirim');
        } catch (\Exception $e) {
            return $this->sendResponse(null, $e->getMessage());
        }
    }

    public function verifyEmail(Request $request)
    {
        if (! $request->hasValidSignature()) {
            return $this->sendResponse(null, 'Tautan verifikasi tidak valid atau sudah kedaluwarsa', 400);
        }

        try {
            $this->authService->verifyEmail((int) $request->route('id'));

            return $this->sendResponse(null, 'Email berhasil diverifikasi');
        } catch (\Exception $e) {
            return $this->sendResponse(null, $e->getMessage(), (int) $e->getCode() ?: 202);
        }
    }

    public function checkToken(Request $request)
    {
        $token = $request->bearerToken();

        if (! $token) {
            return $this->sendError('Token tidak ditemukan', 401);
        }

        if (! $this->authService->checkToken($token)) {
            return $this->sendError('Token kedaluwarsa', 401);
        }

        return $this->sendResponse(['valid' => true], 'Token valid');
    }

    public function checkEmail(Request $request)
    {
        $verified = $this->authService->checkEmailVerified($request->user());

        return $this->sendResponse(['verified' => $verified], $verified ? 'Email sudah diverifikasi' : 'Email belum diverifikasi');
    }

    public function logout(Request $request)
    {
        $this->authService->logout($request->user());

        return $this->sendResponse(null, 'Berhasil keluar');
    }
}
