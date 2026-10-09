<?php

namespace App\Filament\Resources;

use App\Filament\Resources\LessonResource\Pages;
use App\Filament\Resources\LessonResource\RelationManagers;
use App\Models\Lesson;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class LessonResource extends Resource
{
    protected static ?string $model = Lesson::class;

    protected static ?string $navigationIcon = 'heroicon-o-play-circle';

    protected static ?string $navigationGroup = 'Conteúdo';

    protected static ?string $navigationLabel = 'Lições';

    protected static ?string $modelLabel = 'lição';

    protected static ?string $pluralModelLabel = 'lições';

    protected static ?int $navigationSort = 4;

    private const CONTENT_TYPES = [
        'video_upload' => 'Vídeo (upload)',
        'avatar' => 'Avatar dinâmico',
        'live' => 'Aula ao vivo',
        'quiz' => 'Quiz',
        'document' => 'Documento',
        'text' => 'Texto',
    ];

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('module_id')
                    ->label('Módulo')
                    ->relationship('module', 'title')
                    ->searchable()
                    ->preload()
                    ->required(),
                Forms\Components\TextInput::make('title')
                    ->label('Título')
                    ->required()
                    ->maxLength(200),
                Forms\Components\Select::make('content_type')
                    ->label('Tipo de conteúdo')
                    ->options(self::CONTENT_TYPES)
                    ->default('video_upload')
                    ->required()
                    ->live(),
                Forms\Components\TextInput::make('content_url')
                    ->label('URL do conteúdo')
                    ->url()
                    ->maxLength(255)
                    ->visible(fn (Forms\Get $get) => $get('content_type') !== 'avatar'),
                Forms\Components\TextInput::make('avatar_ref')
                    ->label('Referência do avatar (Tavus)')
                    ->helperText('URL, ID de embed ou tavus_video_id entregue pelo colega.')
                    ->maxLength(500)
                    ->visible(fn (Forms\Get $get) => $get('content_type') === 'avatar'),
                Forms\Components\TextInput::make('duration_seconds')
                    ->label('Duração (segundos)')
                    ->numeric()
                    ->default(0),
                Forms\Components\TextInput::make('order_index')
                    ->label('Ordem')
                    ->numeric()
                    ->default(0),
                Forms\Components\Toggle::make('is_downloadable')
                    ->label('Disponível para download'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('order_index')
            ->columns([
                Tables\Columns\TextColumn::make('order_index')
                    ->label('#')
                    ->sortable(),
                Tables\Columns\TextColumn::make('title')
                    ->label('Título')
                    ->searchable()
                    ->weight('bold'),
                Tables\Columns\TextColumn::make('module.title')
                    ->label('Módulo')
                    ->badge()
                    ->sortable(),
                Tables\Columns\TextColumn::make('content_type')
                    ->label('Tipo')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => self::CONTENT_TYPES[$state] ?? $state),
                Tables\Columns\TextColumn::make('duration_seconds')
                    ->label('Duração')
                    ->formatStateUsing(fn (int $state) => gmdate('i:s', $state))
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_downloadable')
                    ->label('Download')
                    ->boolean(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('content_type')
                    ->label('Tipo de conteúdo')
                    ->options(self::CONTENT_TYPES),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLessons::route('/'),
            'create' => Pages\CreateLesson::route('/create'),
            'edit' => Pages\EditLesson::route('/{record}/edit'),
        ];
    }
}
