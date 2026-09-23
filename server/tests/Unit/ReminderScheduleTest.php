<?php

use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Carbon;
use Tests\TestCase;

uses(TestCase::class);

function reminderScheduleEvent(): ?Event
{
    return collect(app(Schedule::class)->events())
        ->first(fn ($event) => str_contains($event->command ?? '', 'notifications:reminder'));
}

test('reminder command is registered on the scheduler', function () {
    expect(reminderScheduleEvent())->not->toBeNull();
});

test('reminder runs daily at 07:00', function () {
    $event = reminderScheduleEvent();

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 7 * * *');
});

test('reminder does not overlap itself', function () {
    $event = reminderScheduleEvent();

    expect($event)->not->toBeNull()
        ->and($event->withoutOverlapping)->toBeTrue();
});

test('reminder schedule resolves the 07:00 slot in the app timezone', function () {
    $event = reminderScheduleEvent();

    $this->travelTo(Carbon::parse('2026-09-22 06:59:00', config('app.timezone')));
    expect($event->isDue(app()))->toBeFalse();

    $this->travelTo(Carbon::parse('2026-09-22 07:00:00', config('app.timezone')));
    expect($event->isDue(app()))->toBeTrue();

    $this->travelBack();
});
