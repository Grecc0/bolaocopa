(function () {
  const STORAGE_KEY = "bolao-copa-state-v1";

  const defaultSettings = {
    exact: 5,
    outcome: 3,
    goal: 1,
  };

  const sampleState = {
    version: 1,
    settings: { ...defaultSettings },
    participants: [
      { id: "p-ana", name: "Ana Souza", contact: "ana@exemplo.com", paid: true },
      { id: "p-bruno", name: "Bruno Lima", contact: "(11) 90000-0000", paid: true },
      { id: "p-carla", name: "Carla Mendes", contact: "", paid: false },
    ],
    matches: [
      {
        id: "m-1",
        phase: "Grupo exemplo",
        date: "2026-06-24",
        home: "Brasil",
        away: "Sérvia",
        homeScore: 2,
        awayScore: 0,
      },
      {
        id: "m-2",
        phase: "Grupo exemplo",
        date: "2026-06-26",
        home: "Argentina",
        away: "Japão",
        homeScore: null,
        awayScore: null,
      },
      {
        id: "m-3",
        phase: "Grupo exemplo",
        date: "2026-06-27",
        home: "França",
        away: "Senegal",
        homeScore: null,
        awayScore: null,
      },
      {
        id: "m-4",
        phase: "Oitavas exemplo",
        date: "2026-06-29",
        home: "Espanha",
        away: "México",
        homeScore: null,
        awayScore: null,
      },
    ],
    predictions: {
      "p-ana": {
        "m-1": { home: 2, away: 0 },
        "m-2": { home: 1, away: 1 },
        "m-3": { home: 2, away: 1 },
      },
      "p-bruno": {
        "m-1": { home: 1, away: 0 },
        "m-2": { home: 2, away: 1 },
        "m-3": { home: 1, away: 1 },
      },
      "p-carla": {
        "m-1": { home: 1, away: 1 },
        "m-2": { home: 0, away: 2 },
      },
    },
  };

  const supabaseConfig = window.BOLAO_SUPABASE_CONFIG || {};
  const hasSupabaseLibrary = Boolean(window.supabase?.createClient);
  const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
  const onlineMode = Boolean(hasSupabaseLibrary && hasSupabaseConfig);
  const db = onlineMode ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;

  let state = clone(sampleState);
  let selectedParticipantId = "";
  let toastTimer = null;
  let remoteReloadTimer = null;

  const els = {};

  document.addEventListener("DOMContentLoaded", async () => {
    cacheElements();
    bindEvents();
    state = await loadState();
    selectedParticipantId = state.participants[0]?.id || "";
    setupRealtime();
    renderAll();

    if (onlineMode) {
      showToast("Banco online conectado");
    } else if (hasSupabaseConfig && !hasSupabaseLibrary) {
      showToast("Supabase não carregou; usando modo local");
    }
  });

  function cacheElements() {
    [
      "summary-grid",
      "dashboard-ranking",
      "next-matches",
      "participant-count",
      "participant-form",
      "participant-name",
      "participant-contact",
      "participants-table",
      "match-count",
      "match-form",
      "match-phase",
      "match-date",
      "match-home",
      "match-away",
      "matches-table",
      "prediction-participant",
      "predictions-table",
      "podium",
      "ranking-table",
      "ranking-updated",
      "settings-form",
      "score-exact",
      "score-outcome",
      "score-goal",
      "export-data",
      "import-data",
      "import-file",
      "reset-demo",
      "clear-data",
      "print-ranking",
      "toast",
    ].forEach((id) => {
      els[toCamel(id)] = document.getElementById(id);
    });
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const tabButton = event.target.closest("[data-tab-target]");
      if (tabButton) {
        setActiveTab(tabButton.dataset.tabTarget);
        return;
      }

      const actionButton = event.target.closest("[data-action]");
      if (!actionButton) return;

      const { action, id } = actionButton.dataset;
      if (action === "delete-participant") deleteParticipant(id);
      if (action === "delete-match") deleteMatch(id);
    });

    els.participantForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addParticipant();
    });

    els.matchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addMatch();
    });

    els.settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveSettings();
    });

    els.participantsTable.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-paid-id]");
      if (!checkbox) return;
      const participant = state.participants.find((item) => item.id === checkbox.dataset.paidId);
      if (!participant) return;
      participant.paid = checkbox.checked;
      persist("Pagamento atualizado", () =>
        runRemote(
          db
            .from("participants")
            .update({ paid: participant.paid })
            .eq("id", participant.id),
        ),
      );
    });

    els.matchesTable.addEventListener("change", (event) => {
      const input = event.target.closest("[data-result-id]");
      if (!input) return;
      updateResult(input.dataset.resultId, input.dataset.side, input.value);
    });

    els.predictionsTable.addEventListener("change", (event) => {
      const input = event.target.closest("[data-prediction-id]");
      if (!input) return;
      updatePrediction(input.dataset.predictionId, input.dataset.side, input.value);
    });

    els.predictionParticipant.addEventListener("change", () => {
      selectedParticipantId = els.predictionParticipant.value;
      renderPredictions();
    });

    els.exportData.addEventListener("click", exportData);
    els.importData.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", importData);
    els.resetDemo.addEventListener("click", resetDemo);
    els.clearData.addEventListener("click", clearData);
    els.printRanking.addEventListener("click", () => {
      setActiveTab("ranking");
      window.print();
    });
  }

  async function loadState() {
    if (!onlineMode) return loadLocalState();

    try {
      return await loadRemoteState();
    } catch (error) {
      console.error("Falha ao carregar Supabase; usando modo local.", error);
      showToast("Falha no banco online; usando modo local");
      return loadLocalState();
    }
  }

  function loadLocalState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return clone(sampleState);

    try {
      return normalizeState(JSON.parse(saved));
    } catch (error) {
      console.warn("Dados salvos inválidos; usando exemplo.", error);
      return clone(sampleState);
    }
  }

  async function loadRemoteState() {
    const [participantsResult, matchesResult, predictionsResult, settingsResult] = await Promise.all([
      db.from("participants").select("*").order("name", { ascending: true }),
      db.from("matches").select("*").order("match_date", { ascending: true }),
      db.from("predictions").select("*"),
      db.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    [
      participantsResult.error,
      matchesResult.error,
      predictionsResult.error,
      settingsResult.error,
    ].forEach((error) => {
      if (error) throw error;
    });

    const remoteState = {
      version: 1,
      settings: settingsResult.data
        ? {
            exact: toInteger(settingsResult.data.exact, defaultSettings.exact),
            outcome: toInteger(settingsResult.data.outcome, defaultSettings.outcome),
            goal: toInteger(settingsResult.data.goal, defaultSettings.goal),
          }
        : { ...defaultSettings },
      participants: (participantsResult.data || []).map(fromDbParticipant),
      matches: (matchesResult.data || []).map(fromDbMatch),
      predictions: {},
    };

    (predictionsResult.data || []).forEach((row) => {
      if (!remoteState.predictions[row.participant_id]) {
        remoteState.predictions[row.participant_id] = {};
      }

      remoteState.predictions[row.participant_id][row.match_id] = {
        home: toScoreOrNull(row.home_score),
        away: toScoreOrNull(row.away_score),
      };
    });

    return normalizeState(remoteState);
  }

  function normalizeState(value) {
    const normalized = {
      version: 1,
      settings: { ...defaultSettings, ...(value?.settings || {}) },
      participants: Array.isArray(value?.participants) ? value.participants : [],
      matches: Array.isArray(value?.matches) ? value.matches : [],
      predictions: value?.predictions && typeof value.predictions === "object" ? value.predictions : {},
    };

    normalized.participants = normalized.participants
      .filter((participant) => participant?.id && participant?.name)
      .map((participant) => ({
        id: String(participant.id),
        name: String(participant.name),
        contact: participant.contact ? String(participant.contact) : "",
        paid: Boolean(participant.paid),
      }));

    normalized.matches = normalized.matches
      .filter((match) => match?.id && match?.home && match?.away)
      .map((match) => ({
        id: String(match.id),
        phase: match.phase ? String(match.phase) : "Grupo",
        date: match.date ? String(match.date) : "",
        home: String(match.home),
        away: String(match.away),
        homeScore: toScoreOrNull(match.homeScore),
        awayScore: toScoreOrNull(match.awayScore),
      }));

    const participantIds = new Set(normalized.participants.map((item) => item.id));
    const matchIds = new Set(normalized.matches.map((item) => item.id));
    const predictions = {};

    Object.entries(normalized.predictions).forEach(([participantId, participantPredictions]) => {
      if (!participantIds.has(participantId) || typeof participantPredictions !== "object") return;
      predictions[participantId] = {};

      Object.entries(participantPredictions).forEach(([matchId, prediction]) => {
        if (!matchIds.has(matchId)) return;
        const home = toScoreOrNull(prediction?.home);
        const away = toScoreOrNull(prediction?.away);
        if (home !== null && away !== null) predictions[participantId][matchId] = { home, away };
      });
    });

    normalized.predictions = predictions;
    return normalized;
  }

  function renderAll() {
    ensureSelectedParticipant();
    renderDashboard();
    renderParticipants();
    renderMatches();
    renderPredictionParticipantSelect();
    renderPredictions();
    renderRanking();
    renderSettings();
  }

  function renderDashboard() {
    const ranking = computeRanking();
    const completedMatches = state.matches.filter(hasResult).length;
    const totalPredictions = countPredictions();
    const leader = ranking[0];

    els.summaryGrid.innerHTML = [
      metricCard("Participantes", state.participants.length, paidSummary()),
      metricCard("Jogos", state.matches.length, `${completedMatches} com resultado`),
      metricCard("Palpites", totalPredictions, `${state.matches.length} jogos cadastrados`),
      metricCard("Líder", leader ? leader.name : "-", leader ? `${leader.points} pontos` : "Sem ranking"),
    ].join("");

    els.dashboardRanking.innerHTML = ranking.length
      ? ranking
          .slice(0, 5)
          .map(
            (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><span class="team-name">${escapeHtml(row.name)}</span></td>
                <td>${row.points}</td>
                <td>${row.exact} exatos</td>
              </tr>
            `,
          )
          .join("")
      : emptyRow(4, "Cadastre participantes para iniciar o ranking");

    const nextMatches = state.matches
      .filter((match) => !hasResult(match))
      .sort(sortByDate)
      .slice(0, 4);

    els.nextMatches.innerHTML = nextMatches.length
      ? nextMatches
          .map(
            (match) => `
              <article class="match-card">
                <div class="match-date">${formatDate(match.date)}</div>
                <div>
                  <strong>${escapeHtml(match.home)} x ${escapeHtml(match.away)}</strong>
                  <span class="muted">${escapeHtml(match.phase)}</span>
                </div>
              </article>
            `,
          )
          .join("")
      : `<div class="empty-state">Nenhum jogo pendente</div>`;
  }

  function renderParticipants() {
    const rankingById = new Map(computeRanking().map((row) => [row.id, row]));
    els.participantCount.textContent = `${state.participants.length} cadastrados`;
    els.participantsTable.innerHTML = state.participants.length
      ? state.participants
          .map((participant) => {
            const rank = rankingById.get(participant.id);
            return `
              <tr>
                <td><span class="team-name">${escapeHtml(participant.name)}</span></td>
                <td class="muted">${escapeHtml(participant.contact || "-")}</td>
                <td>
                  <input class="check-cell" type="checkbox" data-paid-id="${escapeAttr(participant.id)}" ${
                    participant.paid ? "checked" : ""
                  } aria-label="Pago" />
                </td>
                <td>${rank?.points || 0}</td>
                <td>
                  <div class="row-actions">
                    <button class="icon-button" type="button" data-action="delete-participant" data-id="${escapeAttr(
                      participant.id,
                    )}" title="Excluir participante" aria-label="Excluir participante">×</button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")
      : emptyRow(5, "Nenhum participante cadastrado");
  }

  function renderMatches() {
    const sortedMatches = [...state.matches].sort(sortByDate);
    els.matchCount.textContent = `${state.matches.length} cadastrados`;

    els.matchesTable.innerHTML = sortedMatches.length
      ? sortedMatches
          .map(
            (match) => `
              <tr>
                <td>${formatDate(match.date)}</td>
                <td>${escapeHtml(match.phase)}</td>
                <td>
                  <span class="team-name">${escapeHtml(match.home)}</span>
                  <span class="muted"> x </span>
                  <span class="team-name">${escapeHtml(match.away)}</span>
                </td>
                <td>${scoreInputs("result", match.id, match.homeScore, match.awayScore)}</td>
                <td>${statusBadge(hasResult(match) ? "Encerrado" : "Aberto", hasResult(match) ? "done" : "pending")}</td>
                <td>
                  <div class="row-actions">
                    <button class="icon-button" type="button" data-action="delete-match" data-id="${escapeAttr(
                      match.id,
                    )}" title="Excluir jogo" aria-label="Excluir jogo">×</button>
                  </div>
                </td>
              </tr>
            `,
          )
          .join("")
      : emptyRow(6, "Nenhum jogo cadastrado");
  }

  function renderPredictionParticipantSelect() {
    els.predictionParticipant.innerHTML = state.participants.length
      ? state.participants
          .map(
            (participant) => `
              <option value="${escapeAttr(participant.id)}" ${
                participant.id === selectedParticipantId ? "selected" : ""
              }>${escapeHtml(participant.name)}</option>
            `,
          )
          .join("")
      : `<option value="">Cadastre um participante</option>`;
  }

  function renderPredictions() {
    ensureSelectedParticipant();
    const participant = state.participants.find((item) => item.id === selectedParticipantId);
    const sortedMatches = [...state.matches].sort(sortByDate);

    if (!participant) {
      els.predictionsTable.innerHTML = emptyRow(5, "Nenhum participante disponível");
      return;
    }

    els.predictionsTable.innerHTML = sortedMatches.length
      ? sortedMatches
          .map((match) => {
            const prediction = state.predictions[participant.id]?.[match.id] || {};
            const score = scorePrediction(prediction, match);
            return `
              <tr>
                <td>${formatDate(match.date)}</td>
                <td>
                  <span class="team-name">${escapeHtml(match.home)}</span>
                  <span class="muted"> x </span>
                  <span class="team-name">${escapeHtml(match.away)}</span>
                </td>
                <td>${scoreInputs("prediction", match.id, prediction.home, prediction.away)}</td>
                <td>${hasResult(match) ? `${match.homeScore} x ${match.awayScore}` : "-"}</td>
                <td>${score.points}</td>
              </tr>
            `;
          })
          .join("")
      : emptyRow(5, "Cadastre jogos para lançar palpites");
  }

  function renderRanking() {
    const ranking = computeRanking();
    els.rankingUpdated.textContent = `Atualizado ${new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    els.podium.innerHTML = ranking.length
      ? ranking
          .slice(0, 3)
          .map(
            (row, index) => `
              <article class="podium-card">
                <span>${index + 1}º lugar</span>
                <strong>${escapeHtml(row.name)}</strong>
                <small>${row.points} pontos</small>
              </article>
            `,
          )
          .join("")
      : "";

    els.rankingTable.innerHTML = ranking.length
      ? ranking
          .map(
            (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><span class="team-name">${escapeHtml(row.name)}</span></td>
                <td>${row.points}</td>
                <td>${row.exact}</td>
                <td>${row.outcome}</td>
                <td>${row.goals}</td>
                <td>${row.predictionsMade}/${state.matches.length}</td>
                <td>${row.paid ? "Sim" : "Não"}</td>
              </tr>
            `,
          )
          .join("")
      : emptyRow(8, "Ranking vazio");
  }

  function renderSettings() {
    els.scoreExact.value = state.settings.exact;
    els.scoreOutcome.value = state.settings.outcome;
    els.scoreGoal.value = state.settings.goal;
  }

  function addParticipant() {
    const name = els.participantName.value.trim();
    const contact = els.participantContact.value.trim();
    if (!name) return;

    const participant = {
      id: createId("p"),
      name,
      contact,
      paid: false,
    };

    state.participants.push(participant);
    state.predictions[participant.id] = {};
    selectedParticipantId = participant.id;
    els.participantForm.reset();

    persist("Participante adicionado", () =>
      runRemote(db.from("participants").insert(toDbParticipant(participant))),
    );
  }

  function deleteParticipant(id) {
    const participant = state.participants.find((item) => item.id === id);
    if (!participant) return;
    if (!confirm(`Excluir ${participant.name}?`)) return;

    state.participants = state.participants.filter((item) => item.id !== id);
    delete state.predictions[id];
    selectedParticipantId = state.participants[0]?.id || "";

    persist("Participante excluído", () => runRemote(db.from("participants").delete().eq("id", id)));
  }

  function addMatch() {
    const match = {
      id: createId("m"),
      phase: els.matchPhase.value.trim(),
      date: els.matchDate.value,
      home: els.matchHome.value.trim(),
      away: els.matchAway.value.trim(),
      homeScore: null,
      awayScore: null,
    };

    if (!match.phase || !match.date || !match.home || !match.away) return;

    state.matches.push(match);
    els.matchHome.value = "";
    els.matchAway.value = "";
    els.matchHome.focus();

    persist("Jogo adicionado", () => runRemote(db.from("matches").insert(toDbMatch(match))));
  }

  function deleteMatch(id) {
    const match = state.matches.find((item) => item.id === id);
    if (!match) return;
    if (!confirm(`Excluir ${match.home} x ${match.away}?`)) return;

    state.matches = state.matches.filter((item) => item.id !== id);
    Object.values(state.predictions).forEach((participantPredictions) => {
      delete participantPredictions[id];
    });

    persist("Jogo excluído", () => runRemote(db.from("matches").delete().eq("id", id)));
  }

  function updateResult(matchId, side, value) {
    const match = state.matches.find((item) => item.id === matchId);
    if (!match) return;

    match[side === "home" ? "homeScore" : "awayScore"] = toScoreOrNull(value);

    persist(null, () =>
      runRemote(
        db
          .from("matches")
          .update({
            home_score: match.homeScore,
            away_score: match.awayScore,
          })
          .eq("id", matchId),
      ),
    );
  }

  function updatePrediction(matchId, side, value) {
    if (!selectedParticipantId) return;
    const match = state.matches.find((item) => item.id === matchId);
    if (!match) return;

    if (!state.predictions[selectedParticipantId]) state.predictions[selectedParticipantId] = {};
    const current = state.predictions[selectedParticipantId][matchId] || { home: null, away: null };
    current[side] = toScoreOrNull(value);

    if (current.home === null && current.away === null) {
      delete state.predictions[selectedParticipantId][matchId];
    } else {
      state.predictions[selectedParticipantId][matchId] = current;
    }

    persist(null, () => {
      if (current.home === null && current.away === null) {
        return runRemote(
          db
            .from("predictions")
            .delete()
            .eq("participant_id", selectedParticipantId)
            .eq("match_id", matchId),
        );
      }

      if (current.home === null || current.away === null) {
        // Aguarda os dois campos do palpite serem preenchidos antes de salvar no banco online.
        // Isso evita erro quando o usuário digita primeiro apenas um lado do placar.
        return Promise.resolve();
      }

      return runRemote(
        db.from("predictions").upsert(
          {
            participant_id: selectedParticipantId,
            match_id: matchId,
            home_score: current.home,
            away_score: current.away,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "participant_id,match_id" },
        ),
      );
    });
  }

  function saveSettings() {
    state.settings = {
      exact: toInteger(els.scoreExact.value, defaultSettings.exact),
      outcome: toInteger(els.scoreOutcome.value, defaultSettings.outcome),
      goal: toInteger(els.scoreGoal.value, defaultSettings.goal),
    };

    persist("Pontuação salva", () =>
      runRemote(
        db.from("settings").upsert(
          {
            id: 1,
            exact: state.settings.exact,
            outcome: state.settings.outcome,
            goal: state.settings.goal,
          },
          { onConflict: "id" },
        ),
      ),
    );
  }

  function exportData() {
    const file = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bolao-copa-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Dados exportados");
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        state = normalizeState(JSON.parse(reader.result));
        selectedParticipantId = state.participants[0]?.id || "";
        renderAll();

        if (onlineMode) {
          await replaceRemoteState(state);
          showToast("Dados importados para o banco online");
        } else {
          saveLocalState();
          showToast("Dados importados");
        }
      } catch (error) {
        console.error(error);
        showToast("Arquivo inválido");
      } finally {
        els.importFile.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetDemo() {
    if (!confirm("Restaurar os dados de exemplo?")) return;
    state = clone(sampleState);
    selectedParticipantId = state.participants[0]?.id || "";
    persist("Exemplo restaurado", () => replaceRemoteState(state));
  }

  function clearData() {
    if (!confirm("Limpar participantes, jogos e palpites?")) return;
    state = {
      version: 1,
      settings: { ...defaultSettings },
      participants: [],
      matches: [],
      predictions: {},
    };
    selectedParticipantId = "";
    persist("Dados limpos", () => replaceRemoteState(state));
  }

  function computeRanking() {
    return state.participants
      .map((participant) => {
        const row = {
          id: participant.id,
          name: participant.name,
          paid: participant.paid,
          points: 0,
          exact: 0,
          outcome: 0,
          goals: 0,
          predictionsMade: 0,
        };

        state.matches.forEach((match) => {
          const prediction = state.predictions[participant.id]?.[match.id];
          if (hasCompletePrediction(prediction)) row.predictionsMade += 1;
          const score = scorePrediction(prediction, match);
          row.points += score.points;
          row.exact += score.exact ? 1 : 0;
          row.outcome += score.outcome ? 1 : 0;
          row.goals += score.goals;
        });

        return row;
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exact !== a.exact) return b.exact - a.exact;
        if (b.outcome !== a.outcome) return b.outcome - a.outcome;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }

  function scorePrediction(prediction, match) {
    if (!hasResult(match) || !hasCompletePrediction(prediction)) {
      return { points: 0, exact: false, outcome: false, goals: 0 };
    }

    const exact = prediction.home === match.homeScore && prediction.away === match.awayScore;
    const outcome = getOutcome(prediction.home, prediction.away) === getOutcome(match.homeScore, match.awayScore);
    const goals = Number(prediction.home === match.homeScore) + Number(prediction.away === match.awayScore);
    const points = exact
      ? state.settings.exact
      : Number(outcome) * state.settings.outcome + goals * state.settings.goal;

    return { points, exact, outcome: exact ? false : outcome, goals: exact ? 0 : goals };
  }

  function getOutcome(home, away) {
    if (home > away) return "home";
    if (home < away) return "away";
    return "draw";
  }

  async function persist(message, remoteAction) {
    renderAll();

    try {
      if (onlineMode && remoteAction) {
        await remoteAction();
      } else {
        saveLocalState();
      }

      if (message) showToast(message);
    } catch (error) {
      console.error("Falha ao salvar alteração.", error);
      showToast("Não foi possível salvar no banco online");
      scheduleRemoteReload();
    }
  }

  function saveLocalState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async function replaceRemoteState(nextState) {
    await runRemote(db.from("predictions").delete().neq("match_id", "__never__"));
    await runRemote(db.from("matches").delete().neq("id", "__never__"));
    await runRemote(db.from("participants").delete().neq("id", "__never__"));

    await runRemote(
      db.from("settings").upsert(
        {
          id: 1,
          exact: nextState.settings.exact,
          outcome: nextState.settings.outcome,
          goal: nextState.settings.goal,
        },
        { onConflict: "id" },
      ),
    );

    if (nextState.participants.length) {
      await runRemote(db.from("participants").insert(nextState.participants.map(toDbParticipant)));
    }

    if (nextState.matches.length) {
      await runRemote(db.from("matches").insert(nextState.matches.map(toDbMatch)));
    }

    const predictionRows = [];
    Object.entries(nextState.predictions).forEach(([participantId, participantPredictions]) => {
      Object.entries(participantPredictions || {}).forEach(([matchId, prediction]) => {
        if (!hasCompletePrediction(prediction)) return;
        predictionRows.push({
          participant_id: participantId,
          match_id: matchId,
          home_score: prediction.home,
          away_score: prediction.away,
          updated_at: new Date().toISOString(),
        });
      });
    });

    if (predictionRows.length) {
      await runRemote(db.from("predictions").insert(predictionRows));
    }
  }

  async function runRemote(request) {
    if (!onlineMode) return;
    const { error } = await request;
    if (error) throw error;
  }

  function setupRealtime() {
    if (!onlineMode) return;

    db.channel("bolao-copa-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, scheduleRemoteReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, scheduleRemoteReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, scheduleRemoteReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, scheduleRemoteReload)
      .subscribe((status, error) => {
        if (error) {
          console.error("Erro no realtime do Supabase.", error);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          showToast("Atualização em tempo real instável");
        }
      });
  }

  function scheduleRemoteReload() {
    if (!onlineMode) return;

    clearTimeout(remoteReloadTimer);
    remoteReloadTimer = setTimeout(async () => {
      try {
        state = await loadRemoteState();
        renderAll();
      } catch (error) {
        console.error("Falha ao recarregar dados online.", error);
      }
    }, 300);
  }

  function fromDbParticipant(row) {
    return {
      id: String(row.id),
      name: String(row.name),
      contact: row.contact ? String(row.contact) : "",
      paid: Boolean(row.paid),
    };
  }

  function toDbParticipant(participant) {
    return {
      id: participant.id,
      name: participant.name,
      contact: participant.contact || "",
      paid: Boolean(participant.paid),
    };
  }

  function fromDbMatch(row) {
    return {
      id: String(row.id),
      phase: row.phase || "Grupo",
      date: row.match_date || "",
      home: row.home,
      away: row.away,
      homeScore: toScoreOrNull(row.home_score),
      awayScore: toScoreOrNull(row.away_score),
    };
  }

  function toDbMatch(match) {
    return {
      id: match.id,
      phase: match.phase || "Grupo",
      match_date: match.date,
      home: match.home,
      away: match.away,
      home_score: match.homeScore,
      away_score: match.awayScore,
    };
  }

  function ensureSelectedParticipant() {
    if (state.participants.some((participant) => participant.id === selectedParticipantId)) return;
    selectedParticipantId = state.participants[0]?.id || "";
  }

  function setActiveTab(tabId) {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tabTarget === tabId);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === tabId);
    });
  }

  function metricCard(label, value, detail) {
    return `
      <article class="metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
        <small>${escapeHtml(detail)}</small>
      </article>
    `;
  }

  function scoreInputs(kind, id, homeValue, awayValue) {
    const dataName = kind === "result" ? "data-result-id" : "data-prediction-id";
    const label = kind === "result" ? "Resultado" : "Palpite";
    return `
      <div class="score-inputs">
        <input type="number" min="0" max="99" inputmode="numeric" ${dataName}="${escapeAttr(
          id,
        )}" data-side="home" value="${valueOrBlank(homeValue)}" aria-label="${label} mandante" />
        <span>x</span>
        <input type="number" min="0" max="99" inputmode="numeric" ${dataName}="${escapeAttr(
          id,
        )}" data-side="away" value="${valueOrBlank(awayValue)}" aria-label="${label} visitante" />
      </div>
    `;
  }

  function statusBadge(label, variant) {
    return `<span class="status ${escapeAttr(variant)}">${escapeHtml(label)}</span>`;
  }

  function emptyRow(columns, message) {
    return `
      <tr>
        <td colspan="${columns}">
          <div class="empty-state">${escapeHtml(message)}</div>
        </td>
      </tr>
    `;
  }

  function paidSummary() {
    const paid = state.participants.filter((participant) => participant.paid).length;
    return `${paid} pagos`;
  }

  function countPredictions() {
    return Object.values(state.predictions).reduce((total, participantPredictions) => {
      return (
        total +
        Object.values(participantPredictions || {}).filter((prediction) => hasCompletePrediction(prediction)).length
      );
    }, 0);
  }

  function hasResult(match) {
    return Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore);
  }

  function hasCompletePrediction(prediction) {
    return Number.isInteger(prediction?.home) && Number.isInteger(prediction?.away);
  }

  function sortByDate(a, b) {
    const aDate = a.date || "9999-12-31";
    const bDate = b.date || "9999-12-31";
    return aDate.localeCompare(bDate) || a.home.localeCompare(b.home, "pt-BR");
  }

  function formatDate(value) {
    if (!value) return "Sem data";
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  function toScoreOrNull(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
  }

  function toInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
  }

  function valueOrBlank(value) {
    return Number.isInteger(value) ? String(value) : "";
  }

  function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function toCamel(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function showToast(message) {
    if (!els.toast) return;
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("show");
    }, 2200);
  }
})();
