import supabase from './supabase';

export const signUp = async (email, password, name) => {
    // Step 1: Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: name },
        },
    });

    if (authError) {
        console.error('Error signing up:', authError.message);
        return { error: authError.message };
    }

    // Step 2: Check if a profile exists, update it if it does, or create it if it doesn't
    if (authData.user) {
        // First check if the profile already exists
        const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();

        if (existingProfile) {
            // Profile exists, update it
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: name,
                    email: email,
                    role: 2, // Set role to 2 for shop-owner
                    updated_at: new Date().toISOString(),
                })
                .eq('id', authData.user.id);

            if (updateError) {
                console.error('Error updating profile:', updateError.message);
            } else {
                // Check if the user already has a subscription
                const { data: existingSubscription, error: subscriptionCheckError } = await supabase
                    .from('subscriptions')
                    .select('id')
                    .eq('profile_id', authData.user.id)
                    .eq('status', 'Active')
                    .maybeSingle();

                if (subscriptionCheckError) {
                    console.error('Error checking for existing subscription:', subscriptionCheckError.message);
                } else if (!existingSubscription) {
                    // No active subscription found, create the free tier license
                    const { error: subscriptionError } = await supabase.from('subscriptions').insert({
                        license_id: 1, // Free tier license ID
                        profile_id: authData.user.id,
                        status: 'Active',
                    });

                    if (subscriptionError) {
                        console.error('Error assigning free license to existing user:', subscriptionError.message);
                    }
                }
            }
        } else {
            // Profile doesn't exist, create it
            const { error: insertError } = await supabase.from('profiles').insert({
                id: authData.user.id,
                full_name: name,
                email: email,
                role: 2, // Set role to 2 for shop-owner
                updated_at: new Date().toISOString(),
            });

            if (insertError) {
                console.error('Error creating profile:', insertError.message);
            } else {
                // Profile was created successfully, now assign the free tier license (ID: 1)
                const { error: subscriptionError } = await supabase.from('subscriptions').insert({
                    license_id: 1, // Free tier license ID
                    profile_id: authData.user.id,
                    status: 'Active',
                });

                if (subscriptionError) {
                    console.error('Error assigning free license to new user:', subscriptionError.message);
                }
            }
        }
    }

    // Return the user object with a flag indicating email confirmation is required
    return {
        user: authData.user,
        emailConfirmationRequired: true,
    };
};

export const signIn = async (email, password) => {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Error signing in:', error.message);
            return {
                error: error.message,
                errorCode: error.code, // Return the error code
            };
        }

        return { user: data.user };
    } catch (error) {
        console.error('Unexpected error during sign in:', error);
        return { error: 'An unexpected error occurred. Please try again.' };
    }
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error.message);
        return { error: error.message };
    }
    return { success: true };
};

export const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
        console.error('Error resetting password:', error.message);
        return { error: error.message };
    }
    return { success: true };
};

export const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    });
    if (error) {
        console.error('Error updating password:', error.message);
        return { error: error.message };
    }
    return { success: true };
};

export const getCurrentUser = async () => {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
    if (error) {
        console.error('Error getting user:', error.message);
        return { error: error.message };
    }
    return { user };
};
