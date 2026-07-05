-- Demo conversation seed data for Scribrrr.
-- Creates 2 rooms, 4 sessions, 20 speakers, and long multi-person transcripts.

insert into public.rooms (id, room_name, user_id)
overriding system value
values
  (101, 'Product Lab', null),
  (102, 'Campus Project Room', null);

insert into public.sessions (id, user_id, session_name, room_id)
values
  ('11111111-1111-4111-8111-111111111111', null, 'Product Lab - Sprint Planning', 101),
  ('11111111-1111-4111-8111-111111111112', null, 'Product Lab - Demo Review', 101),
  ('22222222-2222-4222-8222-222222222221', null, 'Campus Room - Study App Planning', 102),
  ('22222222-2222-4222-8222-222222222222', null, 'Campus Room - Final Presentation Prep', 102);

insert into public.speakers (id, session_id, display_id, name)
values
  ('aaaaaaaa-0001-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'Aisha'),
  ('aaaaaaaa-0001-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 2, 'Ben'),
  ('aaaaaaaa-0001-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 3, 'Casey'),
  ('aaaaaaaa-0001-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 4, 'Dana'),
  ('aaaaaaaa-0001-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 5, 'Eli'),
  ('aaaaaaaa-0002-4000-8000-000000000001', '11111111-1111-4111-8111-111111111112', 1, 'Maya'),
  ('aaaaaaaa-0002-4000-8000-000000000002', '11111111-1111-4111-8111-111111111112', 2, 'Noah'),
  ('aaaaaaaa-0002-4000-8000-000000000003', '11111111-1111-4111-8111-111111111112', 3, 'Priya'),
  ('aaaaaaaa-0002-4000-8000-000000000004', '11111111-1111-4111-8111-111111111112', 4, 'Omar'),
  ('aaaaaaaa-0002-4000-8000-000000000005', '11111111-1111-4111-8111-111111111112', 5, 'Jun'),
  ('bbbbbbbb-0001-4000-8000-000000000001', '22222222-2222-4222-8222-222222222221', 1, 'Sofia'),
  ('bbbbbbbb-0001-4000-8000-000000000002', '22222222-2222-4222-8222-222222222221', 2, 'Leo'),
  ('bbbbbbbb-0001-4000-8000-000000000003', '22222222-2222-4222-8222-222222222221', 3, 'Hana'),
  ('bbbbbbbb-0001-4000-8000-000000000004', '22222222-2222-4222-8222-222222222221', 4, 'Marcus'),
  ('bbbbbbbb-0001-4000-8000-000000000005', '22222222-2222-4222-8222-222222222221', 5, 'Ivy'),
  ('bbbbbbbb-0002-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 'Nina'),
  ('bbbbbbbb-0002-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 2, 'Theo'),
  ('bbbbbbbb-0002-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 3, 'Grace'),
  ('bbbbbbbb-0002-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 4, 'Ravi'),
  ('bbbbbbbb-0002-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 5, 'Lena');

insert into public.messages (session_id, speaker_id, text, start_time_ms, end_time_ms, confidence)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000001', 'Alright team, this sprint is about making the summary feature feel useful instead of just technically impressive.', 0, 4800, 0.96),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000002', 'I agree. Last demo produced a summary, but it missed who owned the action items, which is the whole point.', 5200, 10400, 0.95),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000003', 'The funniest bug was when it called every speaker "the team" and somehow assigned the coffee machine a deadline.', 10800, 16000, 0.93),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000004', 'Dumb, but useful feedback. We need a stricter prompt and a cleaner transcript JSON structure.', 16400, 21200, 0.95),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000005', 'I can handle the backend route. I will convert messages into a consistent JSON format before sending it to Gemini.', 21600, 27800, 0.97),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000001', 'Good. Decision one: all summary generation goes through the summary service, not directly inside the route.', 28200, 33800, 0.98),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000002', 'I will update the frontend button so users can request a recent two-minute summary from the session page.', 34200, 40200, 0.96),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000003', 'I will test mixed-language transcripts. Some meetings switch between English, Malay, and Arabic in the same sentence.', 40600, 46600, 0.94),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000004', 'Please make sure the final summary is always English. The transcript can be multilingual, but the output should be consistent.', 47000, 53600, 0.96),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000005', 'Risk: if the transcript has too many partial messages, the summary may repeat itself or include unfinished sentences.', 54000, 60000, 0.95),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000001', 'Action item for Eli: filter only final transcript segments before summarising. Due Wednesday.', 60400, 65200, 0.97),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000002', 'Action item for Ben: connect the summary button to the API. Due Thursday morning.', 65600, 70400, 0.96),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000003', 'Open question: do we save summaries as markdown text, JSON sections, or both?', 70800, 75200, 0.94),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000004', 'Let us save markdown first because it is easy to display, then add structured fields later if analytics needs them.', 75600, 82000, 0.95),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000005', 'That works. I will print summaries in the server log during development so we can inspect output quickly.', 82400, 87800, 0.96),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000001', 'Great. Final decision: service-first summary flow, English output, recent summaries stored against the session.', 88200, 94200, 0.98),

  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000001', 'Thanks for joining the demo review. The demo was chaotic, but in a good way. The app did not crash, which is already a victory.', 0, 5600, 0.96),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000002', 'The live transcript was fast, but speaker labels were inconsistent. Sometimes I was Speaker 1, sometimes Speaker 4.', 6000, 12000, 0.95),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000003', 'The summary did capture the main decision, though. It knew we were delaying analytics until after summary generation works.', 12400, 18400, 0.96),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000004', 'The dumb part was the PDF export title. It said "Meeting About Meeting About Meeting". Very recursive, very cursed.', 18800, 24400, 0.93),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000005', 'I can fix the PDF title. It should use session_name and fallback to the session id only if the name is missing.', 24800, 30800, 0.97),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000001', 'Decision: summary quality is higher priority than PDF polish for this week.', 31200, 35600, 0.98),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000002', 'I will work on speaker mapping. If Deepgram gives display ids, we should store them in the speakers table and reuse them.', 36000, 42600, 0.94),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000003', 'I will write a test transcript with interruptions, jokes, and unclear ownership to see if the action items stay accurate.', 43000, 49000, 0.95),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000004', 'Risk: the AI may invent owners when people say things like "someone should do this". The prompt must forbid that.', 49400, 55400, 0.96),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000005', 'Open question: should summaries include jokes? Sometimes they explain context, but sometimes they are just noise.', 55800, 61200, 0.92),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000001', 'Include jokes only if they affect the decision or blocker. Otherwise, no need to summarize every bit of chaos.', 61600, 67400, 0.97),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000002', 'Action item for Noah: stabilize speaker mapping by Friday.', 67800, 71600, 0.96),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000003', 'Action item for Priya: create the messy transcript test set by tomorrow afternoon.', 72000, 76600, 0.97),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000004', 'Action item for Omar: tighten the no-invention prompt rule and test with unclear owner examples.', 77000, 83000, 0.95),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000005', 'Action item for Jun: clean up PDF titles after summary generation is stable.', 83400, 87800, 0.96),
  ('11111111-1111-4111-8111-111111111112', 'aaaaaaaa-0002-4000-8000-000000000001', 'Great. Final note: the demo felt rough, but the core workflow is promising.', 88200, 93000, 0.98),

  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000001', 'For the study app, the core idea is simple: students record group discussions and get clean study notes afterward.', 0, 5600, 0.96),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000002', 'We should not make it too serious. If the group says something silly, the notes should ignore the silly part unless it matters.', 6000, 12000, 0.94),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000003', 'Example: if Marcus says mitochondria are tiny power banks, the summary should translate that into actual biology.', 12400, 18400, 0.93),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000004', 'Tiny power banks is educational. I stand by it. But yes, the final notes should be academically useful.', 18800, 24000, 0.94),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000005', 'We need at least four sections: key concepts, confusing points, examples, and next revision tasks.', 24400, 30000, 0.96),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000001', 'Decision: first version focuses on group study notes, not full lecture transcription.', 30400, 35200, 0.98),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000002', 'I will design the session screen with a big record button and a visible list of recent summaries.', 35600, 41600, 0.96),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000003', 'I will create sample transcripts for biology, economics, and computer science so the prompt is not tuned to one subject.', 42000, 48600, 0.96),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000004', 'Risk: if students talk over each other, the transcript may be messy and the summary may miss important corrections.', 49000, 55000, 0.95),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000005', 'Open question: do we show speaker names in study notes, or just combine everyone into one clean explanation?', 55400, 61000, 0.94),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000001', 'Keep speaker names only for action items or disagreements. For normal explanations, combine the content.', 61400, 67400, 0.97),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000002', 'Action item for Leo: make the recording UI clear enough for tired students at midnight.', 67800, 72800, 0.95),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000003', 'Action item for Hana: prepare three subject-specific transcripts by Monday.', 73200, 77600, 0.96),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000004', 'Action item for Marcus: test overlapping speech and see how bad the transcript gets.', 78000, 83000, 0.94),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000005', 'Action item for Ivy: define the note sections and the wording for confusing points.', 83400, 88400, 0.96),
  ('22222222-2222-4222-8222-222222222221', 'bbbbbbbb-0001-4000-8000-000000000001', 'Final decision: useful notes first, fancy study analytics later.', 88800, 92600, 0.98),

  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000001', 'Today we need to prepare the final presentation. The story should be problem, demo, architecture, risks, then next steps.', 0, 6200, 0.97),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000002', 'The problem slide should be relatable. Everyone has had a group meeting where nobody remembers who promised what.', 6600, 12200, 0.96),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000003', 'We can open with a ridiculous example: five people discuss an assignment and somehow the only recorded action item is "buy snacks".', 12600, 18800, 0.94),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000004', 'Funny, but keep it short. The lecturers care more about architecture and data flow.', 19200, 23800, 0.96),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000005', 'Architecture slide should show client audio to server WebSocket, Deepgram transcription, Gemini summary, and database storage.', 24200, 31000, 0.97),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000001', 'Decision: the demo will use mock audio first, then live audio only if the room Wi-Fi behaves.', 31400, 36600, 0.98),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000002', 'I will prepare the mock transcript. It should be long enough to prove the summary handles multiple speakers.', 37000, 42800, 0.96),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000003', 'I will design the slides. I want the demo slide to show real output, not just bullet points about what it might do.', 43200, 49400, 0.96),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000004', 'I will explain the database schema: rooms contain sessions, sessions have speakers and messages, summaries belong to sessions.', 49800, 56200, 0.97),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000005', 'I will handle the risks slide: transcription accuracy, speaker diarization, privacy, and API cost.', 56600, 62000, 0.96),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000001', 'Open question: do we mention that data is currently seeded and not fully connected to Supabase in every route?', 62400, 68200, 0.95),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000004', 'Yes, but phrase it as next integration step. Be honest without making the project sound unfinished.', 68600, 74000, 0.96),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000002', 'Action item for Theo: build the mock transcript by tonight.', 74400, 78200, 0.97),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000003', 'Action item for Grace: finish slides by tomorrow morning.', 78600, 82400, 0.97),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000004', 'Action item for Ravi: prepare the schema explanation and mention room to session relationships.', 82800, 88400, 0.96),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000005', 'Action item for Lena: write the risk slide and include privacy as a first-class concern.', 88800, 94000, 0.96),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0002-4000-8000-000000000001', 'Final decision: mock demo first, live demo second, and next steps focused on full Supabase integration.', 94400, 100200, 0.98);
