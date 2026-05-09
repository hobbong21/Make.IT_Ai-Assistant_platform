// MaKIT - 회의록 정리 (meeting-notes) 페이지 스크립트
// 기능:
//  1) 메타데이터 입력 (제목/일시/참석자/요청자 이메일)
//  2) Web Speech API 한국어 실시간 받아쓰기 + 수동 텍스트 편집
//  3) 백엔드 POST /api/meeting-notes/summarize 로 AI 정리
//  4) 회의록 미리보기(편집 가능) + Markdown 다운로드 / PDF 저장(인쇄) / mailto: 자동 생성

(function () {
  'use strict';

  var HISTORY_KEY = 'makit_meeting_notes_history_v1';
  var HISTORY_MAX = 10;

  var state = {
    recognition: null,
    isRecording: false,
    finalText: '',     // 확정된 받아쓰기 텍스트
    interimText: '',   // 임시(미확정) 받아쓰기 텍스트
    summary: null,     // 백엔드에서 받은 정리 결과
    tone: 'standard',  // 요약 톤 프리셋: brief | standard | detailed | action
    // --- 원본 오디오 녹음 (MediaRecorder) ---
    mediaRecorder: null,
    audioStream: null,
    audioChunks: [],
    audioBlob: null,
    audioUrl: null,
    audioMime: 'audio/webm',
    recStartedAt: 0,
  };

  // ---------- DOM helpers ----------
  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg, type) {
    if (window.ui && ui.toast) { ui.toast(msg, type || 'info'); return; }
    console.log('[meeting-notes] ' + msg);
  }

  // ---------- 받아쓰기 (Web Speech API) ----------
  function getSpeechRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function setupRecognition() {
    var Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;
    var r = new Ctor();
    r.lang = 'ko-KR';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var res = e.results[i];
        if (res.isFinal) {
          state.finalText += (state.finalText ? ' ' : '') + res[0].transcript.trim();
        } else {
          interim += res[0].transcript;
        }
      }
      state.interimText = interim.trim();
      renderTranscript();
    };
    r.onerror = function (ev) {
      // 'no-speech', 'aborted' 등은 자주 발생 — 사용자 알림은 진짜 오류만
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        toast('마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.', 'error');
        stopRecording();
      } else if (ev.error && ev.error !== 'no-speech' && ev.error !== 'aborted') {
        toast('받아쓰기 오류: ' + ev.error, 'error');
      }
    };
    r.onend = function () {
      // continuous 모드에서도 일정 시간 후 종료될 수 있음 — 사용자가 멈추지 않았으면 재시작
      if (state.isRecording) {
        try { r.start(); } catch (_) { /* already started */ }
      }
    };
    return r;
  }

  // ---------- 원본 오디오 녹음 (MediaRecorder) ----------
  function pickAudioMime() {
    var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    for (var i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return ''; // 빈 문자열이면 브라우저 기본
  }

  async function startAudioRecording() {
    if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // 받아쓰기는 가능해도 MediaRecorder는 안 될 수 있음 — 받아쓰기만 진행
      toast('이 브라우저는 오디오 녹음을 지원하지 않습니다. 받아쓰기만 진행합니다.', 'info');
      return false;
    }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      var mime = pickAudioMime();
      var opts = mime ? { mimeType: mime } : undefined;
      var rec = new MediaRecorder(stream, opts);
      state.audioChunks = [];
      state.audioMime = rec.mimeType || mime || 'audio/webm';
      rec.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) state.audioChunks.push(e.data);
      };
      rec.onstop = function () {
        var blob = new Blob(state.audioChunks, { type: state.audioMime });
        state.audioBlob = blob;
        if (state.audioUrl) { URL.revokeObjectURL(state.audioUrl); }
        state.audioUrl = URL.createObjectURL(blob);
        renderAudioOutput();
      };
      rec.start(1000); // 1초마다 chunk flush
      state.mediaRecorder = rec;
      state.audioStream = stream;
      state.recStartedAt = Date.now();
      return true;
    } catch (err) {
      toast('마이크 접근 실패: ' + (err && err.message || err), 'error');
      return false;
    }
  }

  function stopAudioRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      try { state.mediaRecorder.stop(); } catch (_) { /* ignore */ }
    }
    if (state.audioStream) {
      state.audioStream.getTracks().forEach(function (t) { try { t.stop(); } catch (_) {} });
    }
    state.mediaRecorder = null;
    state.audioStream = null;
  }

  // 페이지 이탈/종료 시 호출 — 진행 중인 녹음과 Blob URL을 모두 해제 (메모리 누수 방지)
  function cleanupAudioResources() {
    state.isRecording = false;
    if (state.recognition) {
      try { state.recognition.abort(); } catch (_) { /* ignore */ }
    }
    stopAudioRecording();
    if (state.audioUrl) {
      try { URL.revokeObjectURL(state.audioUrl); } catch (_) { /* ignore */ }
      state.audioUrl = null;
    }
    state.audioBlob = null;
    state.audioChunks = [];
  }

  async function startRecording() {
    if (state.isRecording) return;
    if (!state.recognition) state.recognition = setupRecognition();
    if (!state.recognition) {
      toast('이 브라우저는 음성 받아쓰기를 지원하지 않습니다. 텍스트 입력을 사용해주세요.', 'error');
      return;
    }
    // 1) 오디오 녹음 먼저 시도 (마이크 권한 동시 획득)
    await startAudioRecording();
    // 2) 받아쓰기 시작
    try {
      state.recognition.start();
      state.isRecording = true;
      updateRecorderUi();
    } catch (err) {
      stopAudioRecording();
      toast('받아쓰기를 시작할 수 없습니다: ' + (err && err.message || ''), 'error');
    }
  }

  function stopRecording() {
    state.isRecording = false;
    if (state.recognition) {
      try { state.recognition.stop(); } catch (_) { /* ignore */ }
    }
    stopAudioRecording();
    // 임시 텍스트는 확정으로 흡수하지 않음 — 사용자가 수동 편집 가능
    state.interimText = '';
    updateRecorderUi();
    renderTranscript();
  }

  function clearTranscript() {
    state.finalText = '';
    state.interimText = '';
    renderTranscript();
  }

  function clearAudio() {
    if (state.audioUrl) {
      try { URL.revokeObjectURL(state.audioUrl); } catch (_) { /* ignore */ }
      state.audioUrl = null;
    }
    state.audioBlob = null;
    state.audioChunks = [];
    renderAudioOutput();
  }

  function downloadAudio() {
    if (!state.audioBlob || !state.audioUrl) return;
    var a = document.createElement('a');
    a.href = state.audioUrl;
    var ext = state.audioMime.indexOf('mp4') !== -1 ? 'mp4'
            : state.audioMime.indexOf('ogg') !== -1 ? 'ogg' : 'webm';
    var titleVal = ($('mnTitle').value || '회의').replace(/[\\/:*?"<>|]/g, '_');
    a.download = titleVal + '_audio.' + ext;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function renderAudioOutput() {
    var box = $('mnAudioOutput');
    if (!box) return;
    if (!state.audioBlob || !state.audioUrl) {
      box.innerHTML = '';
      box.style.display = 'none';
      return;
    }
    var sizeKb = Math.round(state.audioBlob.size / 1024);
    box.style.display = 'block';
    box.innerHTML =
      '<div class="mn-audio-row">' +
      '  <audio controls src="' + state.audioUrl + '" preload="metadata"></audio>' +
      '  <div class="mn-audio-meta">원본 오디오 · ' + sizeKb + ' KB · ' + escapeHtml(state.audioMime) + '</div>' +
      '  <div class="mn-audio-actions">' +
      '    <button type="button" id="mnAudioDownloadBtn" class="mn-btn">오디오 다운로드</button>' +
      '    <button type="button" id="mnAudioClearBtn" class="mn-btn">삭제</button>' +
      '  </div>' +
      '</div>';
    $('mnAudioDownloadBtn').addEventListener('click', downloadAudio);
    $('mnAudioClearBtn').addEventListener('click', clearAudio);
  }

  function updateRecorderUi() {
    var bar = $('mnRecorder');
    var startBtn = $('mnStartBtn');
    var stopBtn = $('mnStopBtn');
    var statusLabel = $('mnRecStatus');
    if (!bar) return;
    if (state.isRecording) {
      bar.classList.add('is-recording');
      startBtn.disabled = true;
      stopBtn.disabled = false;
      statusLabel.textContent = '녹음 중...';
    } else {
      bar.classList.remove('is-recording');
      startBtn.disabled = false;
      stopBtn.disabled = true;
      statusLabel.textContent = '대기';
    }
  }

  // ---------- 트랜스크립트 렌더 (텍스트 영역) ----------
  function renderTranscript() {
    var ta = $('mnTranscript');
    if (!ta) return;
    // 사용자가 textarea에 직접 편집 중인 경우 finalText 동기화
    // 받아쓰기 결과가 들어온 경우에만 자동 갱신, 일반 편집은 그대로 유지
    if (document.activeElement !== ta || state.isRecording) {
      var combined = state.finalText;
      if (state.interimText) {
        combined += (combined ? ' ' : '') + state.interimText;
      }
      ta.value = combined;
    }
  }

  // ---------- AI 정리 ----------
  async function summarize() {
    var transcript = ($('mnTranscript').value || '').trim();
    if (!transcript) {
      toast('회의 내용을 먼저 입력하거나 녹음해주세요.', 'error');
      return;
    }
    var meta = readMeta();
    var btn = $('mnSummarizeBtn');
    btn.disabled = true; btn.textContent = '정리 중...';
    try {
      if (!window.api || !api.meetingNotes || !api.meetingNotes.summarize) {
        throw new Error('API 클라이언트가 로드되지 않았습니다.');
      }
      var res = await api.meetingNotes.summarize({
        title: meta.title,
        meetingAt: meta.meetingAt,
        attendees: meta.attendees,
        transcript: transcript,
        tone: state.tone,
      });
      state.summary = normalizeSummary(res, transcript, meta);
      renderPreview();
      saveToHistory(state.summary);
      toast('회의록 정리를 완료했습니다.', 'success');
    } catch (err) {
      console.error('[meeting-notes] summarize failed', err);
      var msg = (err && err.message) || '알 수 없는 오류';
      toast('AI 정리 실패: ' + msg + ' — 원문으로 회의록을 만들었습니다.', 'error');
      // Backend가 없거나 실패 시 명시적 안내 + 원문 기반 fallback
      state.summary = buildFallback(transcript, meta);
      renderPreview();
    } finally {
      btn.disabled = false; btn.textContent = 'AI로 회의록 정리';
    }
  }

  function normalizeSummary(res, transcript, meta) {
    res = res || {};
    return {
      title: res.title || meta.title || '회의록',
      meetingAt: res.meetingAt || meta.meetingAt || '',
      attendees: Array.isArray(res.attendees) ? res.attendees : meta.attendees,
      summary: res.summary || '',
      decisions: Array.isArray(res.decisions) ? res.decisions : [],
      actionItems: Array.isArray(res.actionItems) ? res.actionItems.map(function (a) {
        return {
          owner: (a && a.owner) || '',
          task: (a && a.task) || '',
          due: (a && a.due) || '',
        };
      }) : [],
      transcript: transcript,
      generatedBy: res.generatedBy || 'ai',
    };
  }

  function buildFallback(transcript, meta) {
    // AI 없이 원문을 그대로 회의록 골격에 끼워 넣음 — 사용자가 미리보기에서 직접 편집 가능
    return {
      title: meta.title || '회의록',
      meetingAt: meta.meetingAt || '',
      attendees: meta.attendees,
      summary: transcript.length > 600 ? transcript.slice(0, 600) + '...' : transcript,
      decisions: [],
      actionItems: [],
      transcript: transcript,
      generatedBy: 'fallback',
    };
  }

  // ---------- 메타데이터 ----------
  function readMeta() {
    return {
      title: ($('mnTitle').value || '').trim(),
      meetingAt: ($('mnMeetingAt').value || '').trim(),
      attendees: ($('mnAttendees').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      requesterEmail: ($('mnRequester').value || '').trim(),
    };
  }

  function formatMeetingAt(s) {
    if (!s) return '';
    // <input type="datetime-local"> 값은 YYYY-MM-DDTHH:mm 형식
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // ---------- 미리보기 (편집 가능 contenteditable) ----------
  function renderPreview() {
    var box = $('mnPreview');
    if (!box) return;
    if (!state.summary) {
      box.innerHTML = '<p class="mn-empty">왼쪽에서 회의 내용을 입력하고 \"AI로 회의록 정리\"를 누르면 여기에 회의록이 표시됩니다.</p>';
      return;
    }
    var s = state.summary;
    var attendeesText = s.attendees && s.attendees.length ? s.attendees.join(', ') : '—';
    var html = '';
    html += '<h3 contenteditable="true" data-field="title">' + escapeHtml(s.title) + '</h3>';
    html += '<p class="mn-meta-line">' +
      '<strong>일시:</strong> <span contenteditable="true" data-field="meetingAt">' + escapeHtml(formatMeetingAt(s.meetingAt) || '—') + '</span>' +
      ' · <strong>참석자:</strong> <span contenteditable="true" data-field="attendees">' + escapeHtml(attendeesText) + '</span>' +
      '</p>';

    html += '<h4>요약</h4>';
    html += '<p contenteditable="true" data-field="summary">' + escapeHtml(s.summary || '(요약 없음)') + '</p>';

    html += '<h4>결정 사항</h4>';
    if (s.decisions.length) {
      html += '<ul contenteditable="true" data-field="decisions">';
      s.decisions.forEach(function (d) { html += '<li>' + escapeHtml(d) + '</li>'; });
      html += '</ul>';
    } else {
      html += '<p class="mn-empty" contenteditable="true" data-field="decisions" style="padding:0;text-align:left;">(없음 — 클릭하여 입력)</p>';
    }

    html += '<h4>액션 아이템</h4>';
    if (s.actionItems.length) {
      html += '<table class="mn-action-table"><thead><tr><th>담당자</th><th>업무</th><th>기한</th></tr></thead><tbody contenteditable="true" data-field="actionItems">';
      s.actionItems.forEach(function (a) {
        html += '<tr>' +
          '<td>' + escapeHtml(a.owner || '—') + '</td>' +
          '<td>' + escapeHtml(a.task || '—') + '</td>' +
          '<td>' + escapeHtml(a.due || '—') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="mn-empty" contenteditable="true" data-field="actionItems" style="padding:0;text-align:left;">(없음 — 클릭하여 입력)</p>';
    }

    if (s.generatedBy === 'fallback') {
      html = '<div class="mn-warn">AI 서버에 연결할 수 없어 원문 기반으로 골격만 생성했습니다. 위 내용을 직접 편집해주세요.</div>' + html;
    }
    box.innerHTML = html;
  }

  // 미리보기에서 사용자가 편집한 값을 다시 state.summary로 흡수 (export 직전에 호출)
  function syncPreviewToState() {
    if (!state.summary) return;
    var box = $('mnPreview');
    if (!box) return;
    var nodes = box.querySelectorAll('[data-field]');
    nodes.forEach(function (el) {
      var field = el.getAttribute('data-field');
      var text = (el.innerText || '').trim();
      if (field === 'title') state.summary.title = text;
      else if (field === 'meetingAt') state.summary.meetingAt = text;
      else if (field === 'attendees') state.summary.attendees = text.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      else if (field === 'summary') state.summary.summary = text;
      else if (field === 'decisions') {
        // ul 또는 안내문이면 줄바꿈/콤마로 split
        var items = Array.prototype.map.call(el.querySelectorAll('li'), function (li) { return (li.innerText || '').trim(); }).filter(Boolean);
        if (!items.length && text && text.indexOf('(없음') !== 0) {
          items = text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
        }
        state.summary.decisions = items;
      } else if (field === 'actionItems') {
        var rows = el.querySelectorAll('tr');
        if (rows.length) {
          state.summary.actionItems = Array.prototype.map.call(rows, function (tr) {
            var tds = tr.querySelectorAll('td');
            return {
              owner: tds[0] ? (tds[0].innerText || '').trim() : '',
              task: tds[1] ? (tds[1].innerText || '').trim() : '',
              due: tds[2] ? (tds[2].innerText || '').trim() : '',
            };
          }).filter(function (a) { return a.task && a.task !== '—'; });
        } else if (text && text.indexOf('(없음') !== 0) {
          // 빈 placeholder(<p>)에 사용자가 자유 텍스트로 입력한 경우.
          // 줄 단위로 split, 각 줄을 'owner | task | due' 또는 'task' 단독으로 파싱.
          state.summary.actionItems = text.split(/\n+/).map(function (line) {
            var t = line.trim(); if (!t) return null;
            var parts = t.split('|').map(function (p) { return p.trim(); });
            if (parts.length >= 3) return { owner: parts[0], task: parts[1], due: parts[2] };
            if (parts.length === 2) return { owner: parts[0], task: parts[1], due: '' };
            return { owner: '', task: t, due: '' };
          }).filter(Boolean);
        } else {
          state.summary.actionItems = [];
        }
      }
    });
  }

  // ---------- 회의록 → Markdown ----------
  function buildMarkdown() {
    var s = state.summary; if (!s) return '';
    var lines = [];
    lines.push('# ' + s.title);
    lines.push('');
    if (s.meetingAt) lines.push('- **일시:** ' + formatMeetingAt(s.meetingAt));
    if (s.attendees && s.attendees.length) lines.push('- **참석자:** ' + s.attendees.join(', '));
    lines.push('');
    lines.push('## 요약');
    lines.push(s.summary || '_(요약 없음)_');
    lines.push('');
    lines.push('## 결정 사항');
    if (s.decisions.length) s.decisions.forEach(function (d) { lines.push('- ' + d); });
    else lines.push('_(없음)_');
    lines.push('');
    lines.push('## 액션 아이템');
    if (s.actionItems.length) {
      lines.push('| 담당자 | 업무 | 기한 |');
      lines.push('| --- | --- | --- |');
      s.actionItems.forEach(function (a) {
        lines.push('| ' + (a.owner || '—') + ' | ' + (a.task || '—') + ' | ' + (a.due || '—') + ' |');
      });
    } else {
      lines.push('_(없음)_');
    }
    return lines.join('\n');
  }

  // ---------- 출력 액션 ----------
  function downloadMarkdown() {
    if (!state.summary) { toast('먼저 회의록을 정리해주세요.', 'error'); return; }
    syncPreviewToState();
    var md = buildMarkdown();
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (state.summary.title || '회의록').replace(/[\\/:*?"<>|]/g, '_') + '.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadJson() {
    if (!state.summary) { toast('먼저 회의록을 정리해주세요.', 'error'); return; }
    syncPreviewToState();
    var payload = {
      exportedAt: new Date().toISOString(),
      tone: state.tone,
      summary: state.summary,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (state.summary.title || '회의록').replace(/[\\/:*?"<>|]/g, '_') + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- 이력 (localStorage 최대 10건) ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[meeting-notes] history parse failed', e);
      return [];
    }
  }

  function persistHistory(arr) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      // quota exceeded — try aggressive trim then retry once
      try {
        var trimmed = arr.slice(0, Math.max(1, Math.floor(arr.length / 2)));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        toast('저장 공간이 부족해 이력을 ' + trimmed.length + '건으로 축소했습니다.', 'info');
        return true;
      } catch (e2) {
        console.warn('[meeting-notes] history persist failed', e2);
        toast('이력 저장에 실패했습니다 (브라우저 저장 공간 부족).', 'error');
        return false;
      }
    }
  }

  // localStorage quota 보호용: 항목 1건의 큰 텍스트 필드 길이 cap
  var HISTORY_TRANSCRIPT_CAP = 8000;   // ~8KB
  var HISTORY_SUMMARY_CAP    = 4000;
  var HISTORY_FIELD_CAP      = 2000;   // decisions/actions/risks/keypoints 각 항목

  function capStr(s, n) {
    if (typeof s !== 'string') return s;
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function capArr(arr, n) {
    if (!Array.isArray(arr)) return arr;
    return arr.map(function (v) { return typeof v === 'string' ? capStr(v, n) : v; });
  }
  function trimSummaryForStorage(summary) {
    if (!summary) return summary;
    var out = {};
    Object.keys(summary).forEach(function (k) { out[k] = summary[k]; });
    if (out.transcript) out.transcript = capStr(out.transcript, HISTORY_TRANSCRIPT_CAP);
    if (out.summary)    out.summary    = capStr(out.summary, HISTORY_SUMMARY_CAP);
    ['decisions', 'actions', 'risks', 'keypoints', 'agenda'].forEach(function (k) {
      if (out[k]) out[k] = capArr(out[k], HISTORY_FIELD_CAP);
    });
    return out;
  }

  function saveToHistory(summary) {
    if (!summary) return;
    var entry = {
      id: 'mn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      savedAt: new Date().toISOString(),
      tone: state.tone,
      title: summary.title || '회의록',
      meetingAt: summary.meetingAt || '',
      summaryPreview: (summary.summary || '').slice(0, 120),
      summary: trimSummaryForStorage(summary),
    };
    var arr = loadHistory();
    arr.unshift(entry);
    if (arr.length > HISTORY_MAX) arr = arr.slice(0, HISTORY_MAX);
    if (persistHistory(arr)) renderHistory();
  }

  function renderHistory() {
    var wrap = $('mnHistoryWrap');
    var list = $('mnHistoryList');
    if (!wrap || !list) return;
    var arr = loadHistory();
    if (!arr.length) {
      wrap.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    wrap.style.display = 'block';
    var html = '';
    arr.forEach(function (item) {
      var when = '';
      try { when = new Date(item.savedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) {}
      html += '<li style="border:1px solid var(--mk-color-border); border-radius:10px; padding:0.5rem 0.625rem; background:var(--mk-color-bg-subtle);">' +
        '<div style="display:flex; gap:0.5rem; align-items:flex-start; justify-content:space-between;">' +
        '<button type="button" class="mn-history-restore" data-id="' + escapeHtml(item.id) + '" style="background:none; border:none; padding:0; text-align:left; cursor:pointer; flex:1; font:inherit; color:var(--mk-color-text);">' +
        '<div style="font-size:0.8125rem; font-weight:600;">' + escapeHtml(item.title) + '</div>' +
        '<div style="font-size:0.7rem; color:var(--mk-color-text-muted); margin-top:0.15rem;">' + escapeHtml(when) + ' · ' + escapeHtml(item.tone || 'standard') + '</div>' +
        (item.summaryPreview ? '<div style="font-size:0.75rem; color:var(--mk-color-text-muted); margin-top:0.25rem; line-height:1.4;">' + escapeHtml(item.summaryPreview) + (item.summaryPreview.length >= 120 ? '...' : '') + '</div>' : '') +
        '</button>' +
        '<button type="button" class="mn-history-del" data-id="' + escapeHtml(item.id) + '" aria-label="삭제" title="삭제" style="background:none; border:none; cursor:pointer; padding:0.25rem; color:var(--mk-color-text-muted); font-size:0.85rem;">×</button>' +
        '</div>' +
        '</li>';
    });
    list.innerHTML = html;
  }

  function restoreHistory(id) {
    var arr = loadHistory();
    var item = arr.find(function (x) { return x.id === id; });
    if (!item || !item.summary) { toast('이력을 찾을 수 없습니다.', 'error'); return; }
    state.summary = item.summary;
    state.tone = item.tone || 'standard';
    syncToneChips();
    // 입력 필드도 동기화 (사용자가 비교/편집 가능)
    if (item.summary.title) $('mnTitle').value = item.summary.title;
    if (item.summary.meetingAt) $('mnMeetingAt').value = item.summary.meetingAt;
    if (item.summary.attendees && item.summary.attendees.length) $('mnAttendees').value = item.summary.attendees.join(', ');
    if (item.summary.transcript) {
      state.finalText = item.summary.transcript;
      state.interimText = '';
      renderTranscript();
    }
    renderPreview();
    toast('이력에서 복원했습니다.', 'success');
  }

  function deleteHistory(id) {
    var arr = loadHistory().filter(function (x) { return x.id !== id; });
    persistHistory(arr);
    renderHistory();
  }

  function clearAllHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
    renderHistory();
    toast('이력을 모두 삭제했습니다.', 'info');
  }

  function syncToneChips() {
    var presets = document.getElementById('mnTonePresets');
    if (!presets) return;
    presets.querySelectorAll('.an-chip').forEach(function (chip) {
      var active = chip.getAttribute('data-tone') === state.tone;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function printAsPdf() {
    if (!state.summary) { toast('먼저 회의록을 정리해주세요.', 'error'); return; }
    syncPreviewToState();
    renderPreview(); // 동기화된 값으로 다시 그리기
    // 약간의 지연 후 인쇄 (DOM 반영 보장)
    setTimeout(function () { window.print(); }, 100);
  }

  function buildMailto() {
    if (!state.summary) { toast('먼저 회의록을 정리해주세요.', 'error'); return; }
    syncPreviewToState();
    var meta = readMeta();
    var to = meta.requesterEmail || '';
    var s = state.summary;
    var subject = '[회의록] ' + (s.title || '회의록') + (s.meetingAt ? ' (' + formatMeetingAt(s.meetingAt) + ')' : '');
    var body = buildMarkdown();
    // mailto: 본문은 길이 제한이 있어(브라우저별 ~2000자) 안전하게 잘라줌
    var MAX = 1800;
    if (body.length > MAX) {
      body = body.slice(0, MAX) + '\n\n--- (이하 생략 — 첨부 회의록 파일을 참고해주세요) ---';
    }
    var href = 'mailto:' + encodeURIComponent(to) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    // 브라우저 mailto 핸들러 트리거
    var a = document.createElement('a');
    a.href = href;
    a.target = '_self';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if (!to) {
      toast('요청자 이메일이 비어 있습니다. 메일 클라이언트에서 직접 입력해주세요.', 'info');
    }
  }

  // ---------- 사이드바 드롭다운 ----------
  function wireSidebarDropdowns() {
    document.querySelectorAll('.nav-dropdown-header').forEach(function (h) {
      h.addEventListener('click', function () {
        var d = h.parentElement; if (d) d.classList.toggle('expanded');
      });
    });
  }

  // ---------- init ----------
  function init() {
    if (window.auth && !auth.requireLogin()) return; // 로그인 필수
    wireSidebarDropdowns();

    // 기본 일시: 지금
    var dt = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    $('mnMeetingAt').value = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
      'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());

    // 받아쓰기 미지원 안내
    if (!getSpeechRecognitionCtor()) {
      var warn = $('mnSpeechWarn');
      if (warn) warn.style.display = 'block';
      $('mnStartBtn').disabled = true;
    }

    // 이벤트 와이어링
    $('mnStartBtn').addEventListener('click', startRecording);
    $('mnStopBtn').addEventListener('click', stopRecording);
    $('mnClearBtn').addEventListener('click', clearTranscript);
    $('mnTranscript').addEventListener('input', function (e) {
      // 사용자가 직접 편집한 값을 finalText로 흡수
      state.finalText = e.target.value;
      state.interimText = '';
    });
    $('mnSummarizeBtn').addEventListener('click', summarize);
    $('mnDownloadMdBtn').addEventListener('click', downloadMarkdown);
    var jsonBtn = $('mnDownloadJsonBtn');
    if (jsonBtn) jsonBtn.addEventListener('click', downloadJson);
    $('mnPrintBtn').addEventListener('click', printAsPdf);
    $('mnMailtoBtn').addEventListener('click', buildMailto);

    // 톤 프리셋 칩
    var presets = document.getElementById('mnTonePresets');
    if (presets) {
      presets.addEventListener('click', function (ev) {
        var chip = ev.target.closest('.an-chip[data-tone]');
        if (!chip) return;
        state.tone = chip.getAttribute('data-tone') || 'standard';
        syncToneChips();
      });
    }

    // 이력 패널: 복원 / 삭제 / 전체 삭제 (event delegation)
    var historyList = document.getElementById('mnHistoryList');
    if (historyList) {
      historyList.addEventListener('click', function (ev) {
        var del = ev.target.closest('.mn-history-del');
        if (del) {
          ev.stopPropagation();
          deleteHistory(del.getAttribute('data-id'));
          return;
        }
        var restore = ev.target.closest('.mn-history-restore');
        if (restore) restoreHistory(restore.getAttribute('data-id'));
      });
    }
    var clearBtn = document.getElementById('mnHistoryClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAllHistory);

    updateRecorderUi();
    renderPreview();
    renderAudioOutput();
    renderHistory();

    // 페이지 이탈 시 진행 중인 녹음과 Blob URL 해제 (메모리 누수 방지)
    window.addEventListener('pagehide', cleanupAudioResources);
    window.addEventListener('beforeunload', cleanupAudioResources);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
