<?php

namespace App\Filament\Resources\ContactRequestResource\Pages;

use App\Filament\Resources\ContactRequestResource;
use Filament\Resources\Pages\ListRecords;

class ListContactRequests extends ListRecords
{
    protected static string $resource = ContactRequestResource::class;
}
