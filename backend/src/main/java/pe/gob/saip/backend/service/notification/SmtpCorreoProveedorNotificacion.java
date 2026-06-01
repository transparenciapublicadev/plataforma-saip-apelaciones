package pe.gob.saip.backend.service.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class SmtpCorreoProveedorNotificacion implements ProveedorNotificacion {

    private final JavaMailSender mailSender;
    private final String remitente;

    public SmtpCorreoProveedorNotificacion(JavaMailSender mailSender,
                                           @Value("${app.notifications.mail.from:no-reply@plataforma-saip.local}")
                                           String remitente) {
        this.mailSender = mailSender;
        this.remitente = remitente;
    }

    @Override
    public String nombre() {
        return "SMTP";
    }

    @Override
    public NotificacionProveedorResultado enviar(NotificacionProveedorRequest request) {
        if (request.destinatario() == null || request.destinatario().isBlank()) {
            return NotificacionProveedorResultado.fallido("SMTP_DESTINATARIO_EMAIL_REQUERIDO");
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(remitente);
            message.setTo(request.destinatario());
            message.setSubject(request.asunto());
            message.setText(request.contenido());
            mailSender.send(message);

            String codigo = "SMTP-" + request.codigoCorrelacion();
            return NotificacionProveedorResultado.enviado(
                    codigo,
                    "CONST-" + codigo,
                    "Mensaje aceptado por el servidor SMTP configurado. La entrega final depende del acuse."
            );
        } catch (MailException ex) {
            return NotificacionProveedorResultado.fallido("SMTP_SEND_FAILED:" + ex.getClass().getSimpleName());
        }
    }
}
