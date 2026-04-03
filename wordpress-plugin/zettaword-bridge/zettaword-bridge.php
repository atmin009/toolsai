<?php
/**
 * Plugin Name: Zettaword Bridge
 * Description: Connect Zettaword to this WordPress site using an API key (no Application Password required).
 * Version: 1.0.0
 * Author: Zettaword
 * License: GPLv2 or later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ZETTWORD_BRIDGE_VERSION', '1.0.0' );

/**
 * Read API key from request: X-Zettaword-Key or Authorization: Bearer …
 */
function zettaword_bridge_get_request_key( WP_REST_Request $request ) {
	$key = $request->get_header( 'x_zettaword_key' );
	if ( ! $key ) {
		$auth = $request->get_header( 'authorization' );
		if ( $auth && preg_match( '/Bearer\s+(.+)/i', $auth, $m ) ) {
			$key = trim( $m[1] );
		}
	}
	return is_string( $key ) ? trim( $key ) : '';
}

function zettaword_bridge_permission( WP_REST_Request $request ) {
	$stored = get_option( 'zettaword_bridge_api_key', '' );
	$key    = zettaword_bridge_get_request_key( $request );
	if ( ! is_string( $stored ) || $stored === '' || $key === '' || ! hash_equals( $stored, $key ) ) {
		return new WP_Error(
			'rest_forbidden',
			'Invalid or missing Zettaword API key.',
			array( 'status' => 401 )
		);
	}
	return true;
}

/** First administrator user id for post_author when using the bridge. */
function zettaword_bridge_admin_user_id() {
	static $uid = null;
	if ( $uid !== null ) {
		return $uid;
	}
	$users = get_users(
		array(
			'role'   => 'administrator',
			'number' => 1,
			'fields' => array( 'ID' ),
		)
	);
	$uid = ! empty( $users ) ? (int) $users[0]->ID : 0;
	return $uid;
}

function zettaword_bridge_rest_test() {
	return array(
		'ok'      => true,
		'name'    => get_bloginfo( 'name' ),
		'url'     => get_bloginfo( 'url' ),
		'version' => ZETTWORD_BRIDGE_VERSION,
	);
}

function zettaword_bridge_rest_terms( WP_REST_Request $request ) {
	$tax = $request->get_param( 'taxonomy' );
	if ( ! in_array( $tax, array( 'categories', 'tags' ), true ) ) {
		return new WP_Error( 'invalid_taxonomy', 'taxonomy must be categories or tags', array( 'status' => 400 ) );
	}
	$taxonomy = ( $tax === 'tags' ) ? 'post_tag' : 'category';
	$page     = max( 1, (int) $request->get_param( 'page' ) ?: 1 );
	$per_page = min( 100, max( 1, (int) $request->get_param( 'per_page' ) ?: 100 ) );
	$args     = array(
		'taxonomy'   => $taxonomy,
		'hide_empty' => false,
		'number'     => $per_page,
		'offset'     => ( $page - 1 ) * $per_page,
	);
	$terms = get_terms( $args );
	if ( is_wp_error( $terms ) ) {
		return $terms;
	}
	$out = array();
	foreach ( $terms as $t ) {
		$out[] = array(
			'id'   => (int) $t->term_id,
			'name' => $t->name,
			'slug' => $t->slug,
		);
	}
	$response = new WP_REST_Response( $out );
	$response->header( 'X-WP-Total', (string) wp_count_terms( array( 'taxonomy' => $taxonomy, 'hide_empty' => false ) ) );
	$response->header( 'X-WP-TotalPages', (string) max( 1, (int) ceil( wp_count_terms( array( 'taxonomy' => $taxonomy, 'hide_empty' => false ) ) / $per_page ) ) );
	return $response;
}

function zettaword_bridge_rest_media( WP_REST_Request $request ) {
	$url = $request->get_param( 'url' );
	if ( ! is_string( $url ) || $url === '' ) {
		return new WP_Error( 'invalid_url', 'Missing url', array( 'status' => 400 ) );
	}
	$parsed = wp_parse_url( $url );
	if ( empty( $parsed['scheme'] ) || ! in_array( $parsed['scheme'], array( 'http', 'https' ), true ) ) {
		return new WP_Error( 'invalid_url', 'Invalid URL', array( 'status' => 400 ) );
	}
	$resp = wp_remote_get(
		$url,
		array(
			'timeout' => 60,
			'redirection' => 3,
		)
	);
	if ( is_wp_error( $resp ) ) {
		return new WP_Error( 'download_failed', $resp->get_error_message(), array( 'status' => 502 ) );
	}
	$code = wp_remote_retrieve_response_code( $resp );
	if ( $code < 200 || $code >= 300 ) {
		return new WP_Error( 'download_failed', 'HTTP ' . $code, array( 'status' => 502 ) );
	}
	$body = wp_remote_retrieve_body( $resp );
	if ( $body === '' || strlen( $body ) > 12 * 1024 * 1024 ) {
		return new WP_Error( 'invalid_file', 'Empty or too large', array( 'status' => 400 ) );
	}
	$ctype = wp_remote_retrieve_header( $resp, 'content-type' );
	$ctype = is_string( $ctype ) ? preg_split( '/;/', $ctype )[0] : 'image/jpeg';
	$ext   = 'jpg';
	if ( strpos( $ctype, 'png' ) !== false ) {
		$ext = 'png';
	} elseif ( strpos( $ctype, 'webp' ) !== false ) {
		$ext = 'webp';
	} elseif ( strpos( $ctype, 'gif' ) !== false ) {
		$ext = 'gif';
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';

	$filename = 'zettaword-' . time() . '.' . $ext;
	$upload   = wp_upload_bits( $filename, null, $body );
	if ( ! empty( $upload['error'] ) ) {
		return new WP_Error( 'upload_failed', $upload['error'], array( 'status' => 500 ) );
	}

	$aid = wp_insert_attachment(
		array(
			'post_mime_type' => $ctype,
			'post_title'     => sanitize_file_name( $filename ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		),
		$upload['file']
	);
	if ( is_wp_error( $aid ) ) {
		return $aid;
	}
	$meta = wp_generate_attachment_metadata( $aid, $upload['file'] );
	wp_update_attachment_metadata( $aid, $meta );

	return array( 'id' => (int) $aid );
}

function zettaword_bridge_rest_posts( WP_REST_Request $request ) {
	$params = $request->get_json_params();
	if ( ! is_array( $params ) ) {
		return new WP_Error( 'invalid_json', 'Expected JSON body', array( 'status' => 400 ) );
	}

	$title   = isset( $params['title'] ) ? sanitize_text_field( (string) $params['title'] ) : '';
	$content = isset( $params['content'] ) ? $params['content'] : '';
	if ( ! is_string( $content ) ) {
		$content = '';
	}
	$status  = isset( $params['status'] ) ? sanitize_key( (string) $params['status'] ) : 'draft';
	$allowed = array( 'draft', 'publish', 'pending', 'private' );
	if ( ! in_array( $status, $allowed, true ) ) {
		$status = 'draft';
	}
	$excerpt = isset( $params['excerpt'] ) ? sanitize_textarea_field( (string) $params['excerpt'] ) : '';
	$slug    = isset( $params['slug'] ) ? sanitize_title( (string) $params['slug'] ) : '';

	$author = zettaword_bridge_admin_user_id();
	if ( $author <= 0 ) {
		return new WP_Error( 'no_user', 'No administrator user found', array( 'status' => 500 ) );
	}

	$postarr = array(
		'post_title'   => $title ?: __( 'Untitled', 'zettaword-bridge' ),
		'post_content' => $content,
		'post_excerpt' => $excerpt,
		'post_status'  => $status,
		'post_type'    => 'post',
		'post_author'  => $author,
	);
	if ( $slug !== '' ) {
		$postarr['post_name'] = $slug;
	}

	$wp_post_id = isset( $params['wp_post_id'] ) ? (int) $params['wp_post_id'] : 0;
	if ( $wp_post_id > 0 ) {
		$postarr['ID'] = $wp_post_id;
		$pid           = wp_update_post( $postarr, true );
	} else {
		$pid = wp_insert_post( $postarr, true );
	}
	if ( is_wp_error( $pid ) ) {
		return $pid;
	}
	$pid = (int) $pid;

	if ( ! empty( $params['categories'] ) && is_array( $params['categories'] ) ) {
		$cat_ids = array_map( 'intval', $params['categories'] );
		$cat_ids = array_filter( $cat_ids );
		wp_set_post_categories( $pid, $cat_ids );
	}
	if ( ! empty( $params['tags'] ) && is_array( $params['tags'] ) ) {
		$tag_ids = array_map( 'intval', $params['tags'] );
		$tag_ids = array_filter( $tag_ids );
		wp_set_object_terms( $pid, $tag_ids, 'post_tag', false );
	}
	if ( ! empty( $params['featured_media'] ) ) {
		$mid = (int) $params['featured_media'];
		if ( $mid > 0 ) {
			set_post_thumbnail( $pid, $mid );
		}
	}

	$link = get_permalink( $pid );
	if ( ! is_string( $link ) ) {
		$link = '';
	}

	return array(
		'id'   => $pid,
		'link' => $link,
	);
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'zettaword/v1',
			'/test',
			array(
				'methods'             => 'GET',
				'callback'            => 'zettaword_bridge_rest_test',
				'permission_callback' => 'zettaword_bridge_permission',
			)
		);
		register_rest_route(
			'zettaword/v1',
			'/terms',
			array(
				'methods'             => 'GET',
				'callback'            => 'zettaword_bridge_rest_terms',
				'permission_callback' => 'zettaword_bridge_permission',
				'args'                => array(
					'taxonomy'   => array( 'required' => true ),
					'page'       => array( 'default' => 1 ),
					'per_page'   => array( 'default' => 100 ),
					'hide_empty' => array( 'default' => false ),
				),
			)
		);
		register_rest_route(
			'zettaword/v1',
			'/media',
			array(
				'methods'             => 'POST',
				'callback'            => 'zettaword_bridge_rest_media',
				'permission_callback' => 'zettaword_bridge_permission',
			)
		);
		register_rest_route(
			'zettaword/v1',
			'/posts',
			array(
				'methods'             => array( 'POST', 'PUT' ),
				'callback'            => 'zettaword_bridge_rest_posts',
				'permission_callback' => 'zettaword_bridge_permission',
			)
		);
	}
);

add_action(
	'admin_menu',
	function () {
		add_options_page(
			'Zettaword Bridge',
			'Zettaword Bridge',
			'manage_options',
			'zettword-bridge',
			'zettword_bridge_settings_page'
		);
	}
);

function zettword_bridge_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( isset( $_POST['zettword_bridge_regenerate'] ) && check_admin_referer( 'zettword_bridge_settings' ) ) {
		$new = wp_generate_password( 48, false, false );
		update_option( 'zettaword_bridge_api_key', $new );
		echo '<div class="notice notice-success"><p>' . esc_html__( 'API key regenerated.', 'zettword-bridge' ) . '</p></div>';
	}
	$key = get_option( 'zettaword_bridge_api_key', '' );
	if ( ! is_string( $key ) || $key === '' ) {
		$key = wp_generate_password( 48, false, false );
		update_option( 'zettaword_bridge_api_key', $key );
	}
	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
		<p><?php esc_html_e( 'Copy this key into Zettaword → Website → WordPress → Zettaword Bridge API key.', 'zettword-bridge' ); ?></p>
		<p><code style="font-size:14px;user-select:all;"><?php echo esc_html( $key ); ?></code></p>
		<form method="post">
			<?php wp_nonce_field( 'zettword_bridge_settings' ); ?>
			<p>
				<button type="submit" name="zettword_bridge_regenerate" class="button" value="1" onclick="return confirm('<?php echo esc_js( __( 'Regenerate key? Zettaword must use the new key.', 'zettword-bridge' ) ); ?>');">
					<?php esc_html_e( 'Regenerate key', 'zettword-bridge' ); ?>
				</button>
			</p>
		</form>
	</div>
	<?php
}

register_activation_hook(
	__FILE__,
	function () {
		if ( ! get_option( 'zettaword_bridge_api_key' ) ) {
			add_option( 'zettaword_bridge_api_key', wp_generate_password( 48, false, false ) );
		}
	}
);
