package pe.gob.saip.backend.model.dto;

/** Contact fields a person may change on their own profile. Document and password stay outside. */
public record ContactoCiudadano(
        String nombreCompleto,
        String email,
        String telefono,
        String direccion,
        String departamento,
        String provincia,
        String distrito) {

    public static ContactoCiudadano validar(String nombre, String email, String telefono, String direccion,
                                             String departamento, String provincia, String distrito) {
        String nombreLimpio = requerido(nombre, 3, 200, "Escribe tu nombre completo.");
        String correo = requerido(email, 5, 100, "Escribe un correo válido.");
        if (!correo.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new IllegalArgumentException("Escribe un correo válido.");
        }
        return new ContactoCiudadano(
                nombreLimpio,
                correo,
                celular(telefono),
                opcional(direccion, 300, "La dirección es demasiado larga."),
                opcional(departamento, 100, "El departamento es demasiado largo."),
                opcional(provincia, 100, "La provincia es demasiado larga."),
                opcional(distrito, 100, "El distrito es demasiado largo."));
    }

    private static String celular(String value) {
        String limpio = opcional(value, 15, "El celular es demasiado largo.");
        if (limpio == null) return null;
        if (!limpio.matches("9\\d{8}")) {
            throw new IllegalArgumentException("El celular debe tener 9 números y empezar con 9.");
        }
        return limpio;
    }

    private static String requerido(String value, int min, int max, String mensaje) {
        String limpio = value == null ? "" : value.trim();
        if (limpio.length() < min || limpio.length() > max) throw new IllegalArgumentException(mensaje);
        return limpio;
    }

    private static String opcional(String value, int max, String mensaje) {
        if (value == null || value.isBlank()) return null;
        String limpio = value.trim();
        if (limpio.length() > max) throw new IllegalArgumentException(mensaje);
        return limpio;
    }
}
