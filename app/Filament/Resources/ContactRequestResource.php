<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ContactRequestResource\Pages;
use App\Models\ContactRequest;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Pedidos de contacto vindos da página pública /contactos.
 * Os dados do pedido são só de leitura; a equipa muda o estado.
 */
class ContactRequestResource extends Resource
{
    protected static ?string $model = ContactRequest::class;

    protected static ?string $navigationIcon = 'heroicon-o-envelope';

    protected static ?string $navigationGroup = 'Contactos';

    protected static ?string $navigationLabel = 'Pedidos de contacto';

    protected static ?string $modelLabel = 'pedido de contacto';

    protected static ?string $pluralModelLabel = 'pedidos de contacto';

    protected static ?int $navigationSort = 1;

    public static function getNavigationBadge(): ?string
    {
        $new = ContactRequest::where('status', 'novo')->count();

        return $new > 0 ? (string) $new : null;
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Pedido')
                    ->columns(2)
                    ->schema([
                        Forms\Components\Select::make('type')->label('Tipo')->options(ContactRequest::TYPES)->disabled(),
                        Forms\Components\TextInput::make('name')->label('Nome')->disabled(),
                        Forms\Components\TextInput::make('email')->label('Email')->disabled(),
                        Forms\Components\TextInput::make('phone')->label('Telefone')->disabled(),
                        Forms\Components\TextInput::make('company')->label('Empresa / Oficina')->disabled(),
                        Forms\Components\Select::make('team_size')->label('Nº de pessoas')->options(ContactRequest::TEAM_SIZES)->disabled(),
                        Forms\Components\Select::make('course_id')->label('Curso de interesse')->relationship('course', 'title')->disabled(),
                        Forms\Components\DateTimePicker::make('created_at')->label('Recebido em')->disabled(),
                        Forms\Components\Textarea::make('message')->label('Mensagem')->rows(6)->disabled()->columnSpanFull(),
                    ]),
                Forms\Components\Section::make('Acompanhamento')
                    ->schema([
                        Forms\Components\Select::make('status')
                            ->label('Estado')
                            ->options(ContactRequest::STATUSES)
                            ->required()
                            ->native(false),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('status')
                    ->label('Estado')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => ContactRequest::STATUSES[$state] ?? $state)
                    ->color(fn (string $state) => match ($state) {
                        'novo' => 'warning',
                        'em_contacto' => 'info',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('type')
                    ->label('Tipo')
                    ->formatStateUsing(fn (string $state) => ContactRequest::TYPES[$state] ?? $state),
                Tables\Columns\TextColumn::make('name')->label('Nome')->searchable(),
                Tables\Columns\TextColumn::make('company')->label('Empresa')->placeholder('—')->searchable(),
                Tables\Columns\TextColumn::make('email')->label('Email')->searchable()->copyable(),
                Tables\Columns\TextColumn::make('course.title')->label('Curso')->placeholder('—')->toggleable(),
                Tables\Columns\TextColumn::make('created_at')->label('Recebido em')->dateTime('d/m/Y H:i')->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Estado')->options(ContactRequest::STATUSES),
                Tables\Filters\SelectFilter::make('type')->label('Tipo')->options(ContactRequest::TYPES),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Abrir'),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function canCreate(): bool
    {
        return false; // os pedidos só chegam pelo site
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListContactRequests::route('/'),
            'edit' => Pages\EditContactRequest::route('/{record}/edit'),
        ];
    }
}
