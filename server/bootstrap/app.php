<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // In production the app sits behind Cloudflare Tunnel, which
        // terminates TLS and forwards the request over plain HTTP. Trusting
        // the proxy headers keeps generated URLs on https:// and stops
        // redirect loops on the email verification and password reset links.
        //
        // The container is not fully booted here, so read the environment
        // directly instead of using app()->isProduction().
        if (env('APP_ENV') === 'production') {
            $middleware->trustProxies(at: '*');
        }
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
