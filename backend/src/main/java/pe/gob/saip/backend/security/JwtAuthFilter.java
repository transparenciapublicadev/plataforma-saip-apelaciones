package pe.gob.saip.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.AccountStatusUserDetailsChecker;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UserDetailsChecker;
import pe.gob.saip.backend.service.SesionJwtService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final SesionJwtService sesiones;
    private final UserDetailsChecker accountStatusChecker = new AccountStatusUserDetailsChecker();

    public JwtAuthFilter(JwtService jwtService, UserDetailsService userDetailsService, SesionJwtService sesiones) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.sesiones = sesiones;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return "/api/auth/login".equals(path)
                || "/api/auth/registro".equals(path)
                || "/api/auth/verificar-email".equals(path)
                || "/api/auth/verificar-dni".equals(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);

            try {
                if (SecurityContextHolder.getContext().getAuthentication() == null) {
                    var sesion = jwtService.extraerSesion(token);
                    Long usuarioId = sesion.usuarioId();
                    UserDetails userDetails = userDetailsService.loadUserByUsername(IdentidadUsuario.subject(usuarioId));
                    accountStatusChecker.check(userDetails);
                    if (!(userDetails instanceof UsuarioAutenticado usuario)
                            || sesion.versionAutenticacion() != usuario.getVersionAutenticacion()
                            || sesiones.estaRevocada(sesion)) {
                        throw new BadCredentialsException("Token inválido");
                    }
                    var auth = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    auth.setDetails(sesion);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (AuthenticationException | JwtException | IllegalArgumentException rejected) {
                // Leave protected routes to the existing generic 401 entry point.
                // Never authenticate a missing/disabled account or expose token details.
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }
}
