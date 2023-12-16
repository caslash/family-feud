//
//  PlayerView.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 12/14/23.
//

import SwiftUI

struct PlayerView<Content: View>: View {
    private var displayName: String?
    private var playerAvatar: Content
    var body: some View {
        VStack {
            playerAvatar
                .padding(.vertical)
                .scaledToFit()
            
            Text(displayName ?? "Invitation Pending")
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .frame(width: 100)
        .shadow(radius: 4)
    }
    
    init(_ displayName: String? = nil, @ViewBuilder playerAvatar: () -> Content) {
        self.displayName = displayName
        self.playerAvatar = playerAvatar()
    }
}

#Preview {
    PlayerView() {
        Image(systemName: "person.crop.circle")
            .imageScale(.large)
    }
    .padding()
}
