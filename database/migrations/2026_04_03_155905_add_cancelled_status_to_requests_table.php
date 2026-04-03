<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->timestamp('cancelled_at')->nullable()->after('declined_at');
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->after('cancelled_at');
        });
    }

    public function down(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->dropColumn(['cancelled_at', 'cancelled_by']);
        });
    }
};
