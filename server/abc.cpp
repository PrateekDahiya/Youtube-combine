#include <stdio.h>
#include <math.h>

#define MAX_USERS 1000 // Assuming a reasonable upper limit

int main()
{
    int N;
    scanf("%d", &N);

    int data_sizes[MAX_USERS];
    int freq[10001] = {0}; // Assuming max data size is 10000

    // Read the data sizes and count their occurrences
    for (int i = 0; i < N; i++)
    {
        scanf("%d", &data_sizes[i]);
        freq[data_sizes[i]]++; // Count occurrences
    }

    int packet_count = 0;

    // Compute the number of packets needed
    for (int i = 0; i < 10001; i++)
    {
        if (freq[i] > 0)
        {
            packet_count += (int)ceil(freq[i] / 3.0); // Distribute users into packets (max 3 per packet)
        }
    }

    printf("%d\n", packet_count);

    return 0;
}
