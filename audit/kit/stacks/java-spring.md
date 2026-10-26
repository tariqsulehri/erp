# Java / Kotlin Spring Boot stack module

**Detection signals:** `pom.xml` or `build.gradle(.kts)` with `spring-boot-starter-*`, `@SpringBootApplication`, `application.properties`/`application.yml`, `src/main/java` or `src/main/kotlin`, `mvnw`/`gradlew`.

**Loads with dimensions:** security, data, performance, reliability, testing, code-health, cicd-supply-chain.

## Vulnerability and defect patterns

### Security
- Actuator exposure: `management.endpoints.web.exposure.include=*`, or `env`, `heapdump`, `threaddump`, `beans`, `mappings`, `loggers`, `configprops` reachable without auth. They leak config, memory, and can change log levels.
- SecurityFilterChain with `permitAll()` on broad patterns, `anyRequest().permitAll()`, or a missing `anyRequest().authenticated()` at the end; matcher order wrong (first match wins).
- `csrf.disable()` (or `csrf(AbstractHttpConfigurer::disable)`) on an app that uses cookie or session auth. Acceptable for stateless token APIs; check which it is.
- No method security: `@EnableMethodSecurity` (or old `@EnableGlobalMethodSecurity`) missing, so `@PreAuthorize`/`@Secured` annotations do nothing.
- Authorization on role only, with no ownership check on the loaded entity (IDOR): look at `findById(id)` in controllers/services with no principal comparison.
- `@RequestBody` entities bound directly to JPA entities: mass assignment of `role`, `id`, `tenantId`. Use DTOs. Missing `@Valid`/`@Validated` and constraint annotations on DTOs.
- Deserialization: `ObjectInputStream.readObject` on untrusted data; Jackson `enableDefaultTyping()` / `activateDefaultTyping` with a permissive validator, `@JsonTypeInfo(use = Id.CLASS)` on untrusted input (polymorphic gadget attacks); XML parsers (`DocumentBuilderFactory`, `SAXParser`, `XMLInputFactory`) without secure processing: XXE.
- SpEL injection: `SpelExpressionParser`/`ExpressionParser.parseExpression` on user input, `@Value("#{...}")` with external data; `StandardEvaluationContext` on user expressions.
- SQL by concatenation: `createNativeQuery("... " + x)`, `@Query` with string building, `JdbcTemplate.query("..." + x)`, `Statement` instead of `PreparedStatement`, JPQL built with `+`. Named or positional parameters are safe.
- Command and path risks: `Runtime.exec`, `ProcessBuilder` with user input; `new File(base, userPath)`, `Paths.get(userPath)` with no normalisation check; `ResponseEntity` serving files by name.
- SSRF and redirects: `RestTemplate`/`WebClient` on user URLs; `redirect:` + user input.
- Secrets in `application.properties`/`application.yml` committed (`spring.datasource.password`, `jwt.secret`, API keys) rather than env or a secret store; logging secrets or tokens (`log.info("... " + request)`), `toString()` of entities with passwords.
- JWT handling: `jjwt`/`nimbus` parsing without signature validation, algorithm not fixed, long or no expiry, hardcoded signing key.
- Password storage: `NoOpPasswordEncoder`, `MessageDigestPasswordEncoder`; expected `BCryptPasswordEncoder`/`DelegatingPasswordEncoder`/`Argon2`.
- CORS: `@CrossOrigin("*")` or `allowedOrigins("*")` with `allowCredentials(true)`.

### Data
- Entities exposed in API responses, leaking fields (use DTOs or `@JsonIgnore` with care).
- `spring.jpa.hibernate.ddl-auto=update|create|create-drop` in production; schema changes should go through Flyway or Liquibase with reviewed scripts.
- Missing `@Column(nullable=false)`/unique constraints in the real schema; `@OneToMany(cascade = ALL, orphanRemoval = true)` deleting more than intended; `CascadeType.REMOVE` on shared data.
- Money as `double`/`float`; should be `BigDecimal`. `java.util.Date` and local time zone assumptions; prefer `Instant`/`OffsetDateTime`.
- Flyway/Liquibase migrations edited after being applied; destructive migrations without a backup plan.

### Performance
- JPA N+1: `@OneToMany`/`@ManyToOne` loaded in loops; fix with `JOIN FETCH`, `@EntityGraph`, or batch fetching. `FetchType.EAGER` on collections.
- `LazyInitializationException` workarounds: `spring.jpa.open-in-view=true` (default) keeps a connection open during view rendering; consider turning it off and fetching explicitly.
- `findAll()` with no `Pageable`; derived queries returning large lists; `count` on every request.
- HikariCP pool sizing (`spring.datasource.hikari.maximum-pool-size`) not matched to the database limit; blocking calls on reactive threads (WebFlux) or inside `@Async` with the default executor.

### Reliability
- `@Transactional` pitfalls: self-invocation (calling a `@Transactional` method from the same class bypasses the proxy); `private` or `final` methods; checked exceptions do not roll back by default (`rollbackFor`); `@Transactional` on a `Controller` only; wrong `propagation`; catching the exception inside the transaction and swallowing it.
- External HTTP calls inside a database transaction; no timeouts on `RestTemplate`/`WebClient`/`HttpClient`; no retry or circuit breaker (`resilience4j`).
- `@Async`, `@Scheduled` jobs with no error handling, no lock in multi-instance deployments (`ShedLock`), non-idempotent handlers for messages.
- Catch-all `catch (Exception e) {}` or `e.printStackTrace()`; no `@ControllerAdvice` returning consistent errors without stack traces (`server.error.include-stacktrace` should stay `never`).
- Graceful shutdown: `server.shutdown=graceful` not set (default is immediate in older setups).

### Testing
- No `@WebMvcTest`/`@SpringBootTest` coverage of security rules (401/403 cases); tests with `@WithMockUser` everywhere that never test real auth.
- Tests that depend on a shared real database instead of Testcontainers or an in-memory equivalent that differs from production SQL.

### Code health
- Business logic in controllers; field injection (`@Autowired` on fields) instead of constructor injection; large service classes; unused dependencies; Lombok `@Data` on JPA entities (broken `equals/hashCode`, lazy loading side effects).

## Framework misconfigurations

- `server.error.include-message`/`include-stacktrace`/`include-binding-errors` set to `always`.
- H2 console enabled (`spring.h2.console.enabled=true`) outside local dev; default credentials such as `spring.security.user.password` generated at startup and logged, or set to a weak value.
- Swagger/OpenAPI UI (`springdoc`, `springfox`) public in production for internal APIs.
- Actuator on the same port as the app with no separate `management.server.port` and no auth; `management.endpoint.health.show-details=always`.
- No TLS settings or reliance on a proxy that is not verified; session cookie flags (`server.servlet.session.cookie.secure`, `http-only`, `same-site`) unset.
- Profiles: `application-dev.yml` values accidentally active in production (`spring.profiles.active`).
- `logging.level.org.hibernate.SQL=DEBUG` or `spring.jpa.show-sql=true` in production (parameter values can leak with `TRACE` binders).

## Scanner and project commands

All run only if approved at Checkpoint A. Build tools run project plugins and download dependencies; prefer a temp copy.
- Build and test (Maven): `./mvnw -q test` or `mvn test`; package: `mvn package -DskipTests`.
- Build and test (Gradle): `./gradlew test`, `./gradlew build`.
- Coverage: JaCoCo, `mvn verify` (if the plugin is configured) or `./gradlew jacocoTestReport`.
- Dependency vulnerabilities: OWASP dependency-check (`mvn org.owasp:dependency-check-maven:check` or the Gradle plugin; needs a vulnerability database download), or `osv-scanner`, `trivy fs`.
- Static analysis: SpotBugs (with Find Security Bugs plugin) via `mvn spotbugs:check` or the Gradle plugin, if configured; `semgrep` with Java rules; Checkstyle/PMD if configured; Kotlin: `detekt`, `ktlint`.
- Dependency listing: `mvn dependency:tree`, `./gradlew dependencies`.

## Where to look first

- Security: classes with `@EnableWebSecurity`, `SecurityFilterChain`, `WebSecurityConfigurerAdapter` (old), `@PreAuthorize`, JWT filters (`OncePerRequestFilter`).
- Controllers: `**/controller/`, `@RestController`; services: `**/service/`; repositories: `**/repository/`.
- Config: `src/main/resources/application*.yml|properties`, `bootstrap.yml`, `@ConfigurationProperties` classes.
- Migrations: `src/main/resources/db/migration` (Flyway), `db/changelog` (Liquibase).
- Tests: `src/test/java`, `src/test/resources`.
- Build: `pom.xml`, `build.gradle(.kts)`, `gradle/libs.versions.toml`, `Dockerfile`.

## Looks wrong but is fine

- `csrf.disable()` on a stateless API that uses bearer tokens and no cookies for auth.
- `permitAll()` on login, health, static, and documented public endpoints.
- `@Autowired` fields in test classes.
- `FetchType.EAGER` on a small, always-needed `@ManyToOne` reference.
- Lombok `@Data` on plain DTOs (not entities).
- `H2` and `ddl-auto=create-drop` in test profiles only.
- `e.printStackTrace()` in a one-off main-class or build script.

## Version notes

- Spring Boot 3 requires Java 17+ and uses `jakarta.*` instead of `javax.*`; Boot 2.x is out of open-source support.
- Spring Security 6 removed `WebSecurityConfigurerAdapter`; config uses `SecurityFilterChain` beans and the lambda DSL; `antMatchers` became `requestMatchers`.
- Spring Security 6 changed some defaults (for example CSRF token handling, `authorizeRequests` to `authorizeHttpRequests`).
- Jackson default typing and Log4j/Spring4Shell-type advisories depend on exact versions; check the dependency tree.
- Verify against the installed version.
