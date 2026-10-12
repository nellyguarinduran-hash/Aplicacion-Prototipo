import { useState } from 'react';
import {
  Stethoscope,
  UserCheck,
  Clock,
  TrendingUp,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Users,
  Timer,
  CreditCard,
  RefreshCw,
  UserX,
  CalendarDays,
  Loader2,
  ChevronLeft,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useNow, formatCountdown } from '@/hooks/useNow';
import { COUNTDOWN_SECONDS } from '@/types';
import type { User as AppUser, Appointment } from '@/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface DoctorPanelProps {
  user: AppUser;
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function generate30MinSlots(startHour: string, endHour: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = startHour.split(':').map(Number);
  const [eh, em] = endHour.split(':').map(Number);
  let curMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (curMin < endMin) {
    const h = Math.floor(curMin / 60);
    const m = curMin % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    curMin += 30;
  }
  return slots;
}

function generateFixedSlots(): string[] {
  const morning = generate30MinSlots('08:00', '12:00');
  const afternoon = generate30MinSlots('14:00', '17:00');
  return [...morning, ...afternoon];
}

const FIXED_SLOTS = generateFixedSlots();

export function DoctorPanel({ user }: DoctorPanelProps) {
  const { data, callNext, markPresent, markAbsentAndReschedule, resetAll, getDoctorSchedule, toggleScheduleDay, loading } = useApp();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'queue' | 'availability'>('queue');

  const handleCallNext = async () => {
    setBusy(true);
    await callNext();
    setBusy(false);
  };

  const handlePresent = async () => {
    setBusy(true);
    await markPresent();
    setBusy(false);
  };

  const handleAbsent = async () => {
    setBusy(true);
    await markAbsentAndReschedule();
    setBusy(false);
  };

  const handleReset = async () => {
    setBusy(true);
    await resetAll();
    setBusy(false);
  };

  const waitingPatients = data.appointments
    .filter((a) => a.status === 'checked-in' || a.status === 'rescheduled')
    .sort((a, b) => a.ticketNumber - b.ticketNumber);

  const calledPatient = data.appointments.find((a) => a.id === data.currentCalledId);
  const inAttendance = data.appointments.find((a) => a.status === 'in-attendance');

  const attendedToday = data.appointments.filter((a) => a.status === 'attended');
  const avgTime = data.attendedCount > 0
    ? Math.round(data.totalConsultationMinutes / data.attendedCount)
    : 0;

  const countdownRemaining = calledPatient && data.countdownEndsAt
    ? Math.max(0, Math.floor((data.countdownEndsAt - now) / 1000))
    : 0;
  const countdownProgress = calledPatient
    ? ((COUNTDOWN_SECONDS - countdownRemaining) / COUNTDOWN_SECONDS) * 100
    : 0;

  const attendanceElapsed = inAttendance?.attendanceStartAt
    ? Math.floor((now - inAttendance.attendanceStartAt) / 60000)
    : 0;

  const formatDistance = (m: number | undefined) => {
    if (m === undefined) return '—';
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  };

  return (
    <div className="min-h-[calc(100vh-140px)] px-4 py-5 max-w-md mx-auto">
      {/* Doctor profile */}
      <div className="bg-gradient-to-br from-sky-600 to-blue-700 rounded-3xl p-5 shadow-lg shadow-sky-200 mb-4 text-white animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold">{user.name}</p>
            <div className="flex items-center gap-1.5 text-white/80 text-sm">
              <CreditCard className="w-3.5 h-3.5" />
              CC: {user.cedula}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-white/80 text-sm bg-white/10 rounded-lg px-3 py-2">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{data.sede.name}</span>
        </div>
      </div>

      {/* View tabs */}
      <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setView('queue')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            view === 'queue' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-600'
          }`}
        >
          <Users className="w-4 h-4" />
          Sala de Espera
        </button>
        <button
          onClick={() => setView('availability')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            view === 'availability' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-600'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Mi Disponibilidad
        </button>
      </div>

      {view === 'availability' && (
        <ErrorBoundary fallbackTitle="Error en Mi Disponibilidad">
          <AvailabilityCalendarSection
            doctorCedula={user.cedula}
            doctorName={user.name}
            specialty={user.specialty ?? 'Medicina General'}
            loading={loading}
            appointments={data.appointments}
            getSchedule={getDoctorSchedule}
            onToggleDay={toggleScheduleDay}
          />
        </ErrorBoundary>
      )}

      {view === 'queue' && (
        <>
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4 animate-slide-up">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-slate-500">Atendidos hoy</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{data.attendedCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-medium text-slate-500">Tiempo promedio</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {avgTime}<span className="text-base font-medium text-slate-400"> min</span>
          </p>
        </div>
      </div>

      {/* In-attendance banner */}
      {inAttendance && (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 shadow-md shadow-emerald-200 mb-4 text-white animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-5 h-5" />
            <span className="text-sm font-medium text-white/80">En consulta ahora</span>
          </div>
          <p className="text-xl font-bold">
            #{String(inAttendance.ticketNumber).padStart(2, '0')} · {inAttendance.patientName}
          </p>
          <div className="flex items-center gap-1.5 text-white/90 text-sm mt-2 bg-white/10 rounded-lg px-3 py-1.5">
            <Clock className="w-4 h-4" />
            <span>En consulta: {attendanceElapsed} min</span>
          </div>
        </div>
      )}

      {/* Countdown card — when patient is called */}
      {calledPatient && (
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 shadow-lg shadow-red-200 mb-4 text-white text-center animate-bounce-in">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Timer className="w-5 h-5" />
            <span className="text-sm font-medium text-white/80">Llamado en curso</span>
          </div>
          <p className="text-lg font-bold mb-3">
            #{String(calledPatient.ticketNumber).padStart(2, '0')} · {calledPatient.patientName}
          </p>

          <div className="inline-flex items-center gap-2 bg-white/15 rounded-2xl px-5 py-2.5 mb-3">
            <span className="text-3xl font-extrabold font-mono tracking-tight">
              {formatCountdown(countdownRemaining)}
            </span>
          </div>

          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${countdownProgress}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePresent}
              disabled={busy}
              className="bg-white/20 hover:bg-white/30 active:scale-[0.98] transition-all
                         font-semibold py-3 rounded-xl flex items-center justify-center gap-2
                         disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              Paciente Presente
            </button>
            <button
              onClick={handleAbsent}
              disabled={busy}
              className="bg-white/20 hover:bg-white/30 active:scale-[0.98] transition-all
                         font-semibold py-3 rounded-xl flex items-center justify-center gap-2
                         disabled:opacity-50"
            >
              <UserX className="w-5 h-5" />
              Ausente / Reagendar
            </button>
          </div>
        </div>
      )}

      {/* Call next button — only when no countdown active */}
      {!calledPatient && (
        <button
          onClick={handleCallNext}
          disabled={waitingPatients.length === 0 || busy}
          className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl
                     hover:bg-emerald-600 active:scale-[0.98] transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2.5 shadow-md shadow-emerald-200 mb-4"
        >
          <UserCheck className="w-6 h-6" />
          {inAttendance ? 'Finalizar y Llamar Siguiente' : 'Llamar Siguiente Paciente'}
        </button>
      )}

      {/* Appointment list */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-600" />
            Citas en espera
            <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {waitingPatients.length}
            </span>
          </h3>
        </div>

        {waitingPatients.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No hay pacientes en espera.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {waitingPatients.map((apt, idx) => (
              <AppointmentRow
                key={apt.id}
                apt={apt}
                position={idx + 1}
                isNext={idx === 0 && !calledPatient}
                distanceText={formatDistance(apt.gpsDistance)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Attended today */}
      {attendedToday.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Atendidos ({attendedToday.length})
          </h3>
          <div className="space-y-2">
            {attendedToday.slice(-4).reverse().map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl p-3 flex items-center gap-3 border border-slate-100"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-700">
                    #{String(p.ticketNumber).padStart(2, '0')} · {p.patientName}
                  </span>
                </div>
                {p.attendanceStartAt && p.attendanceEndAt && (
                  <span className="text-xs text-slate-400">
                    {Math.round((p.attendanceEndAt - p.attendanceStartAt) / 60000)} min
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={handleReset}
        disabled={busy}
        className="w-full text-sm text-slate-400 py-2 flex items-center justify-center gap-1.5 hover:text-slate-600
                       disabled:opacity-50"
      >
        <RefreshCw className="w-4 h-4" />
        Reiniciar con datos de prueba
      </button>
        </>
      )}
    </div>
  );
}

interface AppointmentRowProps {
  apt: Appointment;
  position: number;
  isNext: boolean;
  distanceText: string;
}

function AppointmentRow({ apt, isNext, distanceText }: AppointmentRowProps) {
  return (
    <div
      className={`bg-white rounded-xl p-3 flex items-center gap-3 border transition-all animate-slide-in ${
        isNext ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-100'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          isNext ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {String(apt.ticketNumber).padStart(2, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{apt.patientName}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {apt.scheduledTime}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {distanceText}
          </span>
          {apt.status === 'rescheduled' && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              REAGENDADO
            </span>
          )}
          {isNext && (
            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
              SIGUIENTE
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-200" />
    </div>
  );
}

// ============================================================
// Availability Calendar Section — Monthly calendar with per-day
// time range management (current + next month)
// ============================================================
interface AvailabilityCalendarSectionProps {
  doctorCedula: string;
  doctorName: string;
  specialty: string;
  loading: boolean;
  appointments: import('@/types').Appointment[];
  getSchedule: (cedula: string) => import('@/types').DoctorScheduleEntry[];
  onToggleDay: (doctorCedula: string, date: string) => Promise<void>;
}

function AvailabilityCalendarSection({
  doctorCedula,
  doctorName,
  specialty,
  loading,
  appointments,
  getSchedule,
  onToggleDay,
}: AvailabilityCalendarSectionProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [savingDay, setSavingDay] = useState(false);
  const [busy, setBusy] = useState(false);

  const schedule = getSchedule(doctorCedula) ?? [];
  const scheduleMap = new Map(schedule.map((s) => [s.scheduleDate, s]));

  // Determine allowed month range: current and next month
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    // Only allow going back if still within range (current month is the earliest)
    const prev = new Date(viewYear, viewMonth - 1, 1);
    if (prev >= currentMonthStart) {
      if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
      else setViewMonth(viewMonth - 1);
    }
  };

  const nextMonthNav = () => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    if (next <= new Date(today.getFullYear(), today.getMonth() + 1, 1)) {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
      else setViewMonth(viewMonth + 1);
    }
  };

  const isPastDay = (day: number): boolean => {
    const dateObj = new Date(viewYear, viewMonth, day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dateObj < todayMidnight;
  };

  const getDayStatus = (day: number): 'scheduled' | 'full' | 'off' | 'past' => {
    if (isPastDay(day)) return 'past';
    const dateStr = formatDate(viewYear, viewMonth, day);
    if (!scheduleMap.has(dateStr)) return 'off';
    const takenSlots = appointments.filter(
      (a) =>
        a.scheduledDate === dateStr &&
        (a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'rescheduled'),
    ).length;
    return takenSlots >= FIXED_SLOTS.length ? 'full' : 'scheduled';
  };

  const handleDayClick = async (day: number) => {
    if (isPastDay(day)) return;
    const dateStr = formatDate(viewYear, viewMonth, day);
    setBusy(true);

    if (scheduleMap.has(dateStr)) {
      setSavingDay(true);
      await onToggleDay(doctorCedula, dateStr);
      setSavingDay(false);
    } else {
      setSavingDay(true);
      await onToggleDay(doctorCedula, dateStr);
      setSavingDay(false);
    }
    setBusy(false);
  };

  const totalScheduledDays = schedule.length;
  const totalSlots = totalScheduledDays * FIXED_SLOTS.length;

  const canGoPrev = new Date(viewYear, viewMonth - 1, 1) >= currentMonthStart;
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= new Date(today.getFullYear(), today.getMonth() + 1, 1);

  return (
    <div className="space-y-4">
      {/* Specialty section — read-only for doctors */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-sky-600" />
          Mi Especialidad Médica
        </h3>
        <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-5 h-5 text-sky-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400 font-medium">Especialidad asignada</p>
            <p className="text-base font-semibold text-slate-800">{specialty}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Solo el administrador puede modificar</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-sky-600" />
          Calendario de Disponibilidad
        </h3>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-3/4" />
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-slate-100" />
              ))}
            </div>
          </div>
        ) : (
        <>
        <p className="text-sm text-slate-500">
          Haz clic en un día para marcarlo como día de atención. El horario fijo es de 8:00 AM a 12:00 PM y de 2:00 PM a 5:00 PM, con intervalos de 30 minutos.
        </p>

        {/* Fixed schedule info */}
        <div className="bg-sky-50 rounded-xl p-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-sky-600 flex-shrink-0" />
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Horario fijo:</span> 08:00 - 12:00 y 14:00 - 17:00
            <span className="text-slate-400 ml-1">({FIXED_SLOTS.length} intervalos/día)</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-400" /> Día programado
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-400" /> Cupo lleno
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-white border border-slate-200" /> No labora
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-100" /> Pasado
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totalScheduledDays}</p>
            <p className="text-xs text-slate-500">Días programados</p>
          </div>
          <div className="bg-sky-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-sky-600">{totalSlots}</p>
            <p className="text-xs text-slate-500">Intervalos de 30 min</p>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-700">
            {MONTH_LABELS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonthNav}
            disabled={!canGoNext}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[10px] font-semibold text-slate-400 py-1">
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} />;

            const status = getDayStatus(day);

            let cellClass = 'bg-white border border-slate-200 text-slate-400';
            if (status === 'scheduled') cellClass = 'bg-emerald-400 border border-emerald-400 text-white hover:bg-emerald-500';
            if (status === 'full') cellClass = 'bg-red-400 border border-red-400 text-white cursor-not-allowed';
            if (status === 'past') cellClass = 'bg-slate-50 border border-slate-100 text-slate-300 cursor-not-allowed';

            return (
              <button
                key={idx}
                type="button"
                disabled={status === 'past' || status === 'full' || savingDay || busy}
                onClick={() => handleDayClick(day)}
                className={`aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center ${cellClass}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Fixed slots preview */}
        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Intervalos de 30 min por día
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FIXED_SLOTS.map((slot) => (
              <span
                key={slot}
                className="text-xs font-medium text-sky-700 bg-sky-100 px-2 py-1 rounded-md"
              >
                {slot}
              </span>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
